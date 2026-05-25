import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PendingAuthQueue } from '../src/auth-handoff/pending-auth-requests.js';
import { fakeCodexEventsForScenario, type FakeCodexScenario } from '../src/codex/fake-codex-upstream.js';
import { listSupportedModels } from '../src/models/codex-model-policy.js';
import { adaptCursorRequestToCodexResponses } from '../src/protocol/cursor-request-adapter.js';
import { superviseResponsesEvents } from '../src/protocol/responses-stream-supervisor.js';
import { InMemoryUsageStore } from '../src/usage/usage-store.js';

const repoRoot = path.resolve(__dirname, '../../..');
const capturesRoot = path.join(repoRoot, 'harness-capture/captures');

const captures = {
	gpt54: '20260524-180636-cf145060.json',
	gpt54Mini: '20260524-180723-3f16d29e.json',
	custom: '20260524-181130-50655fd6.json',
	curlSmoke: '20260524-180518-3f5ff2e3.json'
} as const;

describe('existing harness captures', () => {
	it('are present and redacted enough to seed executable fixtures', () => {
		for (const fileName of Object.values(captures)) {
			const raw = readCaptureRaw(fileName);

			expect(raw).not.toMatch(/refreshToken|accessToken|idToken|sk-[A-Za-z0-9]/);
			expect(raw).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
			expect(raw).toMatch(/Bearer\.\.\./);
		}
	});

	it('classifies the captured request shapes', () => {
		expect(readCapture(captures.gpt54).analysis.request_shape).toBe('responses');
		expect(readCapture(captures.gpt54Mini).analysis.request_shape).toBe('responses');
		expect(readCapture(captures.custom).analysis.request_shape).toBe('chat_completions');
		expect(readCapture(captures.curlSmoke).analysis.request_shape).toBe('chat_completions');
	});
});

describe('model policy', () => {
	it('keeps Cursor-Facing and Upstream Model IDs distinct for the explicit workaround', () => {
		const models = listSupportedModels({ gpt54ToGpt55WorkaroundEnabled: true });
		const recommended = models.find((model) => model.id === 'gpt-5.4');

		expect(recommended).toMatchObject({
			id: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			recommended: true,
			workaroundRequired: true,
			policyState: 'workaround_enabled'
		});
		expect(models.map((model) => model.id)).not.toContain('gpt-5.5');
		expect(models.map((model) => model.id)).not.toContain('custom');
	});
});

describe('Cursor request adapter', () => {
	it('adapts captured gpt-5.4 Responses-shaped requests to Codex Responses', () => {
		const capture = readCapture(captures.gpt54);
		const adapted = adaptCursorRequestToCodexResponses(capture.request.body_json, {
			gpt54ToGpt55WorkaroundEnabled: true
		});

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.requestShape).toBe('responses');
		expect(adapted.route.cursorFacingModelId).toBe('gpt-5.4');
		expect(adapted.route.upstreamModelId).toBe('gpt-5.5');
		expect(adapted.upstreamRequest.model).toBe('gpt-5.5');
		expect(adapted.upstreamRequest).toHaveProperty('input');
		expect(adapted.upstreamRequest).not.toHaveProperty('messages');
	});

	it('keeps the custom capture diagnostic-only', () => {
		const capture = readCapture(captures.custom);
		const adapted = adaptCursorRequestToCodexResponses(capture.request.body_json, {
			gpt54ToGpt55WorkaroundEnabled: true
		});

		expect(adapted.ok).toBe(false);
		if (adapted.ok) {
			return;
		}
		expect(adapted.errorCode).toBe('unsupported_model');
	});
});

describe('fake Codex upstream stream fixtures', () => {
	const scenarios: FakeCodexScenario[] = [
		'success_text',
		'success_tool',
		'hidden_reasoning',
		'response_failed',
		'response_incomplete',
		'hard_quota',
		'transient_rate_limit',
		'context_length',
		'provider_failure',
		'stream_close'
	];

	it.each(scenarios)('supervises %s without exposing hidden reasoning as content', (scenario) => {
		const result = superviseResponsesEvents(fakeCodexEventsForScenario(scenario), {
			model: 'gpt-5.5',
			created: 1
		});

		const serialized = JSON.stringify(result.chunks);
		expect(serialized).not.toContain('private fixture reasoning');

		if (scenario.startsWith('success') || scenario === 'hidden_reasoning') {
			expect(result.done).toBe(true);
			expect(result.error).toBeNull();
			expect(result.usage?.completion_tokens_details?.reasoning_tokens).toBe(5);
			return;
		}

		expect(result.done).toBe(false);
		expect(result.error).not.toBeNull();
	});
});

describe('pending auth handoff state machine', () => {
	it('delivers a pending request to a long-poll and receives request-scoped auth', async () => {
		const queue = new PendingAuthQueue({ requestTimeoutMs: 500 });
		const authPromise = queue.requestAuth('normal');
		const polled = await queue.poll(50);

		expect(polled).toMatchObject({ reason: 'normal', state: 'request_delivered' });
		expect(queue.getState()).toBe('request_delivered');

		const accepted = queue.respond(polled?.id ?? '', {
			ok: true,
			context: {
				accessToken: 'fixture-access-token',
				expiresAt: Date.now() + 60_000,
				localAccountKey: 'acct_local_fixture'
			}
		});

		expect(accepted).toBe(true);
		await expect(authPromise).resolves.toMatchObject({ ok: true });
		expect(queue.getState()).toBe('response_received');
	});

	it('times out bounded pending requests and rejects stale responses', async () => {
		const queue = new PendingAuthQueue({ requestTimeoutMs: 10 });
		const authPromise = queue.requestAuth('normal');
		const response = await authPromise;

		expect(response).toMatchObject({ ok: false, code: 'auth_handoff_timeout' });
		expect(queue.getState()).toBe('timed_out');
		expect(
			queue.respond('missing', {
				ok: false,
				code: 'auth_required',
				message: 'stale'
			})
		).toBe(false);
	});
});

describe('safe usage records', () => {
	it('stores completed and failed fixture records without unsafe fields', () => {
		const store = new InMemoryUsageStore();

		store.record({
			id: 'usage_fixture_success',
			timestamp: Date.now(),
			latencyMs: 12,
			status: 'completed',
			cursorFacingModelId: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			requestShape: 'responses',
			localAccountKey: 'acct_local_fixture',
			inputTokens: 100,
			cachedInputTokens: 40,
			outputTokens: 20,
			reasoningTokens: 5,
			totalTokens: 120,
			finishReason: 'stop',
			outputStarted: true,
			errorCategory: 'none'
		});

		store.record({
			id: 'usage_fixture_failure',
			timestamp: Date.now(),
			latencyMs: 5,
			status: 'failed',
			cursorFacingModelId: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			requestShape: 'responses',
			localAccountKey: 'acct_local_fixture',
			outputStarted: false,
			errorCategory: 'quota',
			errorCode: 'insufficient_quota'
		});

		expect(store.list()).toHaveLength(2);
		expect(JSON.stringify(store.list())).not.toMatch(/prompt|authorization|accessToken|email/i);
	});
});

interface Capture {
	request: {
		body_json: Record<string, unknown>;
	};
	analysis: {
		request_shape: string;
	};
}

function readCapture(fileName: string): Capture {
	return JSON.parse(readCaptureRaw(fileName)) as Capture;
}

function readCaptureRaw(fileName: string): string {
	return fs.readFileSync(path.join(capturesRoot, fileName), 'utf8');
}
