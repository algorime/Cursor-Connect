import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PendingAuthQueue } from '../src/auth-handoff/pending-auth-requests.js';
import { fakeCodexEventsForScenario, type FakeCodexScenario } from '../src/codex/fake-codex-upstream.js';
import { listSupportedModels, readModelRoutingSettingsFromEnv } from '../src/models/codex-model-policy.js';
import { adaptCursorRequestToCodexResponses } from '../src/protocol/cursor-request-adapter.js';
import { parseSseEvents } from '../src/protocol/sse.js';
import { superviseResponsesEvents } from '../src/protocol/responses-stream-supervisor.js';
import { InMemoryUsageStore } from '../src/usage/usage-store.js';

const repoRoot = path.resolve(__dirname, '../../..');
const protocolFixturesRoot = path.join(repoRoot, 'apps/api/tests/fixtures/protocol');

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
	it('keeps verified Cursor routing separate from current Codex upstream availability', () => {
		const models = listSupportedModels({ gpt54ToGpt55WorkaroundEnabled: true });
		const recommended = models.find((model) => model.id === 'gpt-5.5');
		const sol = models.find((model) => model.id === 'gpt-5.6-sol');
		const terra = models.find((model) => model.id === 'gpt-5.6-terra');
		const luna = models.find((model) => model.id === 'gpt-5.6-luna');
		const fallback = models.find((model) => model.id === 'gpt-5.4');

		expect(models.map((model) => model.id)).toEqual([
			'gpt-5.5',
			'gpt-5.6-sol',
			'gpt-5.6-terra',
			'gpt-5.6-luna',
			'gpt-5.4-mini',
			'gpt-5.4'
		]);
		expect(recommended).toMatchObject({
			id: 'gpt-5.5',
			upstreamModelId: 'gpt-5.5',
			recommended: true,
			workaroundRequired: false,
			policyState: 'ready'
		});
		for (const currentModel of [sol, terra, luna]) {
			expect(currentModel).toMatchObject({
				recommended: false,
				workaroundRequired: false,
				policyState: 'routing_not_verified'
			});
		}
		expect(fallback).toMatchObject({
			id: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			recommended: false,
			workaroundRequired: true,
			policyState: 'workaround_enabled'
		});
		expect(models.map((model) => model.id)).not.toContain('custom');
	});

	it('can read advanced model routing overrides from env while preserving explicit rewrites', () => {
		const models = listSupportedModels(readModelRoutingSettingsFromEnv({
			CODEX_AUTH_EXT_SUPPORTED_MODELS: 'gpt-5.4,gpt-5.4-mini,gpt-5.5',
			CODEX_AUTH_EXT_MODEL_REWRITES: 'gpt-5.5:gpt-5.5'
		}));

		expect(models.map((model) => model.id)).toEqual(['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.5']);
		expect(models.find((model) => model.id === 'gpt-5.5')).toMatchObject({
			upstreamModelId: 'gpt-5.5',
			recommended: true,
			workaroundRequired: false,
			policyState: 'ready'
		});
	});
});

describe('Cursor request adapter', () => {
	it.each([
		{
			name: 'gpt-5.5 direct route',
			body: {
				model: 'gpt-5.5',
				stream: true,
				input: [{ role: 'user', content: 'direct reasoning route probe' }],
				reasoning: { effort: 'high', summary: 'auto' }
			},
			settings: { gpt54ToGpt55WorkaroundEnabled: false },
			expectedCursorModel: 'gpt-5.5',
			expectedUpstreamModel: 'gpt-5.5',
			expectedShape: 'responses'
		},
		{
			name: 'gpt-5.4 with the workaround enabled',
			body: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'reasoning route probe' }],
				reasoning: { effort: 'medium', summary: 'auto' }
			},
			settings: { gpt54ToGpt55WorkaroundEnabled: true },
			expectedCursorModel: 'gpt-5.4',
			expectedUpstreamModel: 'gpt-5.5',
			expectedShape: 'responses'
		},
		{
			name: 'gpt-5.4 with the workaround disabled',
			body: {
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'reasoning route probe' }],
				reasoning: { effort: 'medium', summary: 'auto' }
			},
			settings: { gpt54ToGpt55WorkaroundEnabled: false },
			expectedCursorModel: 'gpt-5.4',
			expectedUpstreamModel: 'gpt-5.4',
			expectedShape: 'responses'
		},
		{
			name: 'gpt-5.4-mini with the workaround enabled',
			body: {
				model: 'gpt-5.4-mini',
				stream: true,
				messages: [{ role: 'user', content: 'mini reasoning route probe' }],
				reasoning: { effort: 'low', summary: 'auto' }
			},
			settings: { gpt54ToGpt55WorkaroundEnabled: true },
			expectedCursorModel: 'gpt-5.4-mini',
			expectedUpstreamModel: 'gpt-5.4-mini',
			expectedShape: 'chat_completions'
		}
	])('preserves reasoning while resolving $name', ({ body, settings, expectedCursorModel, expectedUpstreamModel, expectedShape }) => {
		const adapted = adaptCursorRequestToCodexResponses(body, settings);

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.requestShape).toBe(expectedShape);
		expect(adapted.route.cursorFacingModelId).toBe(expectedCursorModel);
		expect(adapted.route.upstreamModelId).toBe(expectedUpstreamModel);
		expect(adapted.upstreamRequest.model).toBe(expectedUpstreamModel);
		expect(adapted.upstreamRequest.reasoning).toEqual(body.reasoning);
	});

	it('preserves current Codex reasoning, verbosity, and output controls', () => {
		const adapted = adaptCursorRequestToCodexResponses(
			{
				model: 'gpt-5.6-sol',
				stream: true,
				messages: [{ role: 'user', content: 'current model settings probe' }],
				reasoning: { effort: 'max', summary: 'auto' },
				verbosity: 'high',
				max_output_tokens: 4096
			},
			{ gpt54ToGpt55WorkaroundEnabled: false }
		);

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.route).toEqual({
			cursorFacingModelId: 'gpt-5.6-sol',
			upstreamModelId: 'gpt-5.6-sol',
			policyState: 'routing_not_verified'
		});
		expect(adapted.upstreamRequest).toMatchObject({
			model: 'gpt-5.6-sol',
			reasoning: { effort: 'max', summary: 'auto' },
			text: { verbosity: 'high' },
			max_output_tokens: 4096,
			parallel_tool_calls: true,
			store: false
		});
	});

	it('translates Chat Completions image content for current multimodal Codex models', () => {
		const adapted = adaptCursorRequestToCodexResponses(
			{
				model: 'gpt-5.6-luna',
				messages: [
					{
						role: 'user',
						content: [
							{ type: 'text', text: 'Describe this image.' },
							{
								type: 'image_url',
								image_url: {
									url: 'data:image/png;base64,AAAA',
									detail: 'high'
								}
							}
						]
					}
				]
			},
			{ gpt54ToGpt55WorkaroundEnabled: false }
		);

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.upstreamRequest.input).toEqual([
			{
				role: 'user',
				content: [
					{ type: 'input_text', text: 'Describe this image.' },
					{
						type: 'input_image',
						image_url: 'data:image/png;base64,AAAA',
						detail: 'high'
					}
				]
			}
		]);
	});

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
		expect(adapted.upstreamRequest.reasoning).toEqual({ effort: 'medium', summary: 'auto' });
		expect(adapted.upstreamRequest).toHaveProperty('input');
		expect(adapted.upstreamRequest).not.toHaveProperty('messages');
		expect(adapted.upstreamRequest).not.toHaveProperty('metadata');
		expect(adapted.upstreamRequest).not.toHaveProperty('user');
		expect(adapted.upstreamRequest).not.toHaveProperty('prompt_cache_retention');
		expect(adapted.upstreamRequest).not.toHaveProperty('stream_options');
		expect(adapted.upstreamRequest).toMatchObject({
			stream: true,
			store: false,
			parallel_tool_calls: true,
			prompt_cache_key: '6b1a468c-a86c-4d4e-9770-6f68a0e50f15'
		});
		expect(typeof adapted.upstreamRequest.instructions).toBe('string');
		expect(JSON.stringify(adapted.upstreamRequest.input)).not.toContain('"role":"system"');
	});

	it('falls back to Cursor conversation headers for prompt cache identity', () => {
		const adapted = adaptCursorRequestToCodexResponses(
			{
				model: 'gpt-5.4',
				stream: true,
				input: [{ role: 'user', content: 'synthetic fixture request' }]
			},
			{ gpt54ToGpt55WorkaroundEnabled: true },
			{ 'x-cursor-conversation-id': 'conversation-from-header' }
		);

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.upstreamRequest.prompt_cache_key).toBe('conversation-from-header');
	});

	it('converts Chat Completions messages into Codex Responses input', () => {
		const capture = readCapture(captures.curlSmoke);
		const adapted = adaptCursorRequestToCodexResponses(capture.request.body_json, {
			gpt54ToGpt55WorkaroundEnabled: true
		});

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.requestShape).toBe('chat_completions');
		expect(adapted.upstreamRequest).not.toHaveProperty('messages');
		expect(adapted.upstreamRequest).toMatchObject({
			model: 'gpt-5.5',
			stream: true,
			store: false,
			parallel_tool_calls: true
		});
		expect(adapted.upstreamRequest.input).toEqual([
			{
				role: 'user',
				content: [{ type: 'input_text', text: 'public harness smoke' }]
			}
		]);
	});

	it('converts gpt-5.4-mini Chat Completions messages into Codex Responses input', () => {
		const adapted = adaptCursorRequestToCodexResponses(
			{
				model: 'gpt-5.4-mini',
				stream: true,
				messages: [{ role: 'user', content: 'mini chat shape' }]
			},
			{ gpt54ToGpt55WorkaroundEnabled: true }
		);

		expect(adapted.ok).toBe(true);
		if (!adapted.ok) {
			return;
		}

		expect(adapted.requestShape).toBe('chat_completions');
		expect(adapted.upstreamRequest).toMatchObject({
			model: 'gpt-5.4-mini',
			stream: true,
			store: false,
			parallel_tool_calls: true,
			input: [
				{
					role: 'user',
					content: [{ type: 'input_text', text: 'mini chat shape' }]
				}
			]
		});
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

	it('rejects unsupported model IDs before creating an upstream request', () => {
		const adapted = adaptCursorRequestToCodexResponses(
			{
				model: 'custom',
				stream: true,
				input: [{ role: 'user', content: 'must not route upstream' }],
				reasoning: { effort: 'medium', summary: 'auto' }
			},
			{ gpt54ToGpt55WorkaroundEnabled: true }
		);

		expect(adapted).toMatchObject({
			ok: false,
			statusCode: 400,
			errorCategory: 'invalid_request',
			errorCode: 'unsupported_model'
		});
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
		expect(serialized).not.toContain('"content":"private fixture reasoning"');

		if (
			scenario.startsWith('success') ||
			scenario === 'hidden_reasoning' ||
			scenario === 'response_failed' ||
			scenario === 'response_incomplete' ||
			scenario === 'hard_quota' ||
			scenario === 'context_length' ||
			scenario === 'stream_close'
		) {
			expect(result.done).toBe(true);
			if (scenario.startsWith('success') || scenario === 'hidden_reasoning') {
				expect(result.error).toBeNull();
				expect(result.usage?.completion_tokens_details?.reasoning_tokens).toBe(5);
			} else {
				expect(result.error).not.toBeNull();
			}
			return;
		}

		expect(result.done).toBe(true);
		expect(result.error).not.toBeNull();
	});

	it('emits Cursor-compatible text chunks, a terminal chunk, and a separate usage chunk', () => {
		const result = superviseResponsesEvents(
			[
				{ type: 'response.output_text.delta', delta: 'hi' },
				{
					type: 'response.completed',
					response: {
						usage: {
							input_tokens: 10,
							output_tokens: 3,
							total_tokens: 13,
							input_tokens_details: { cached_tokens: 4 },
							output_tokens_details: { reasoning_tokens: 2 }
						}
					}
				}
			],
			{ model: 'gpt-5.5', created: 1, id: 'chatcmpl-test' }
		);

		expect(result.chunks[0]).toMatchObject({
			id: 'chatcmpl-test',
			object: 'chat.completion.chunk',
			created: 1,
			model: 'gpt-5.5',
			choices: [{ index: 0, delta: { role: 'assistant', content: 'hi' }, finish_reason: null }]
		});
		expect(result.chunks.at(-2)).toMatchObject({
			choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
		});
		expect(result.chunks.at(-1)).toMatchObject({
			choices: [],
			usage: {
				prompt_tokens: 10,
				completion_tokens: 3,
				total_tokens: 13,
				prompt_tokens_details: { cached_tokens: 4 },
				completion_tokens_details: { reasoning_tokens: 2 }
			}
		});
		expect(result.finishReason).toBe('stop');
		expect(result.error).toBeNull();
	});

	it('emits zero-valued token detail fields when upstream omits usage details', () => {
		const result = superviseResponsesEvents(
			[
				{
					type: 'response.completed',
					response: {
						usage: {
							input_tokens: 10,
							output_tokens: 3,
							total_tokens: 13
						}
					}
				}
			],
			{ model: 'gpt-5.5', created: 1, id: 'chatcmpl-test' }
		);

		expect(result.chunks.at(-1)).toMatchObject({
			choices: [],
			usage: {
				prompt_tokens_details: { cached_tokens: 0 },
				completion_tokens_details: { reasoning_tokens: 0 }
			}
		});
	});

	it('emits Cursor-compatible tool call chunks and finishes with tool_calls', () => {
		const result = superviseResponsesEvents(
			[
				{
					type: 'response.output_item.added',
					item: {
						type: 'function_call',
						call_id: 'call_1',
						name: 'Shell',
						arguments: ''
					}
				},
				{ type: 'response.function_call_arguments.delta', delta: '{"cmd"' },
				{ type: 'response.function_call_arguments.delta', delta: ':"ls"}' },
				{ type: 'response.completed', response: { usage: null } }
			],
			{ model: 'gpt-5.5', created: 1, id: 'chatcmpl-test' }
		);

		expect(result.chunks[0].choices[0].delta).toEqual({
			role: 'assistant',
			content: null,
			tool_calls: [
				{
					index: 0,
					id: 'call_1',
					type: 'function',
					function: {
						name: 'Shell',
						arguments: ''
					}
				}
			]
		});
		expect(result.chunks[1].choices[0].delta).toEqual({
			tool_calls: [{ index: 0, function: { arguments: '{"cmd"' } }]
		});
		expect(result.chunks[2].choices[0].delta).toEqual({
			tool_calls: [{ index: 0, function: { arguments: ':"ls"}' } }]
		});
		expect(result.chunks.at(-1)?.choices[0].finish_reason).toBe('tool_calls');
		expect(result.finishReason).toBe('tool_calls');
		expect(JSON.stringify(result.chunks)).not.toContain('"type":"function_call"');
		expect(result.error).toBeNull();
	});

	it('correlates interleaved tool argument deltas by item and output index', () => {
		const result = superviseResponsesEvents(
			[
				{
					type: 'response.output_item.added',
					output_index: 2,
					item: {
						type: 'function_call',
						id: 'item_2',
						call_id: 'call_2',
						name: 'Read',
						arguments: ''
					}
				},
				{
					type: 'response.output_item.added',
					output_index: 1,
					item: {
						type: 'function_call',
						id: 'item_1',
						call_id: 'call_1',
						name: 'Shell',
						arguments: ''
					}
				},
				{
					type: 'response.function_call_arguments.delta',
					item_id: 'item_2',
					output_index: 2,
					sequence_number: 4,
					delta: '{"path":"a"}'
				},
				{
					type: 'response.function_call_arguments.delta',
					item_id: 'item_1',
					output_index: 1,
					sequence_number: 5,
					delta: '{"cmd":"pwd"}'
				},
				{ type: 'response.completed', response: { status: 'completed', usage: null } }
			],
			{ model: 'gpt-5.6-sol', created: 1, id: 'chatcmpl-test' }
		);

		expect(result.chunks[2].choices[0].delta).toEqual({
			tool_calls: [{ index: 0, function: { arguments: '{"path":"a"}' } }]
		});
		expect(result.chunks[3].choices[0].delta).toEqual({
			tool_calls: [{ index: 1, function: { arguments: '{"cmd":"pwd"}' } }]
		});
		expect(result.finishReason).toBe('tool_calls');
		expect(result.error).toBeNull();
	});

	it('hides reasoning content by default while preserving native metadata', () => {
		const result = superviseResponsesEvents(
			[
				{ type: 'response.output_item.added', item: { type: 'reasoning' } },
				{ type: 'response.reasoning_summary_text.delta', delta: 'thinking' },
				{ type: 'response.output_text.delta', delta: 'answer' },
				{ type: 'response.completed', response: { usage: null } }
			],
			{ model: 'gpt-5.5', created: 1 }
		);

		expect(result.chunks[0].choices[0].delta).toMatchObject({
			role: 'assistant',
			content: null,
			reasoning_content: 'thinking',
			reasoning_details: [{ type: 'reasoning.text', text: 'thinking' }]
		});
		expect(result.chunks[1].choices[0].delta).toEqual({
			role: 'assistant',
			content: 'answer'
		});
		expect(JSON.stringify(result.chunks)).not.toContain('"content":"thinking"');
	});

	it('treats failed and incomplete Responses events as terminal protocol outcomes', () => {
		const failed = superviseResponsesEvents(
			[
				{
					type: 'response.failed',
					response: { error: { code: 'invalid_request', message: 'upstream failed' } }
				}
			],
			{ model: 'gpt-5.5', created: 1 }
		);
		const incomplete = superviseResponsesEvents(
			[
				{
					type: 'response.incomplete',
					response: { incomplete_details: { reason: 'max_output_tokens' } }
				}
			],
			{ model: 'gpt-5.5', created: 1 }
		);

		expect(failed.chunks).toEqual([]);
		expect(failed.done).toBe(true);
		expect(failed.error).toMatchObject({ category: 'invalid_request', code: 'invalid_request' });
		expect(incomplete.chunks).toEqual([]);
		expect(incomplete.done).toBe(true);
		expect(incomplete.error).toMatchObject({ category: 'stream', code: 'response_incomplete' });
		expect(JSON.stringify([failed, incomplete])).not.toContain('upstream failed');
	});

	it('treats stream close before completion as a failed terminal outcome', () => {
		const result = superviseResponsesEvents(
			[
				{ type: 'response.output_text.delta', delta: 'partial' }
			],
			{ model: 'gpt-5.5', created: 1 }
		);

		expect(result.done).toBe(true);
		expect(result.outputStarted).toBe(true);
		expect(result.error).toMatchObject({
			category: 'stream',
			code: 'stream_closed_before_completion'
		});
		expect(result.chunks).toHaveLength(1);
	});
});

describe('Responses SSE parsing', () => {
	it('parses event names, multiline data, done sentinels, and trailing events', () => {
		const events = parseSseEvents(
			[
				'event: response.output_text.delta',
				'data: {"delta":"hi"}',
				'',
				'data: [DONE]',
				'',
				'event: response.completed',
				'data: {"response":{"usage":null}}'
			].join('\n')
		);

		expect(events).toEqual([
			{ type: 'response.output_text.delta', delta: 'hi' },
			{ type: 'response.completed', response: { usage: null } }
		]);
	});

	it('adapts a recorded cursor-azure single tool-call stream into Cursor-safe chunks', () => {
		const events = parseSseEvents(
			fs.readFileSync(
				path.join(protocolFixturesRoot, 'reply_single_tool_call.upstream_response.sse'),
				'utf8'
			)
		);
		const result = superviseResponsesEvents(events, { model: 'gpt-5.5', created: 1 });
		const toolCallChunk = result.chunks.find((chunk) =>
			Boolean((chunk.choices[0]?.delta.tool_calls as unknown[] | undefined)?.length)
		);

		expect(toolCallChunk?.choices[0].delta).toMatchObject({
			role: 'assistant',
			content: null,
			tool_calls: [
				{
					index: 0,
					type: 'function',
					function: {
						name: 'REDACTED'
					}
				}
			]
		});
		expect(result.finishReason).toBe('tool_calls');
		expect(result.error).toBeNull();
		expect(JSON.stringify(result.chunks)).not.toContain('"type":"function_call"');
	});

	it('adapts a recorded stream without closing newlines to a completed text response', () => {
		const events = parseSseEvents(
			fs.readFileSync(
				path.join(protocolFixturesRoot, 'sse_without_closing_new_lines.upstream_response.sse'),
				'utf8'
			)
		);
		const result = superviseResponsesEvents(events, { model: 'gpt-5.5', created: 1 });

		expect(result.done).toBe(true);
		expect(result.error).toBeNull();
		expect(result.chunks.some((chunk) => chunk.choices[0]?.delta.content === 'pong')).toBe(true);
		expect(result.usage?.total_tokens).toBe(8517);
		expect(result.chunks.at(-1)?.choices).toEqual([]);
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

	it('does not deliver new auth requests to expired long-poll waiters', async () => {
		const queue = new PendingAuthQueue({ requestTimeoutMs: 500 });
		await expect(queue.poll(1)).resolves.toBeNull();

		const authPromise = queue.requestAuth('normal');
		const polled = await queue.poll(50);

		expect(polled).toMatchObject({ reason: 'normal', state: 'request_delivered' });
		expect(queue.respond(polled?.id ?? '', {
			ok: true,
			context: {
				accessToken: 'fixture-access-token',
				expiresAt: Date.now() + 60_000,
				localAccountKey: 'acct_local_fixture'
			}
		})).toBe(true);
		await expect(authPromise).resolves.toMatchObject({ ok: true });
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
	return fs.readFileSync(path.join(protocolFixturesRoot, fileName), 'utf8');
}
