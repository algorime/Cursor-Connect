import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SqliteUsageStore } from '../src/usage/sqlite-usage-store.js';
import { assertSafeUsageRecord } from '../src/usage/usage-store.js';

describe('SqliteUsageStore', () => {
	it('persists safe usage records across reopen', async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-auth-usage-'));
		const dbPath = path.join(dir, 'usage.sqlite');
		const first = await SqliteUsageStore.open(dbPath);
		const record = {
			id: 'usage_fixture_1',
			timestamp: 1,
			latencyMs: 25,
			status: 'completed' as const,
			cursorFacingModelId: 'gpt-5.4',
			upstreamModelId: 'gpt-5.5',
			requestShape: 'responses' as const,
			localAccountKey: 'codex_local_fixture',
			inputTokens: 100,
			cachedInputTokens: 80,
			outputTokens: 20,
			reasoningTokens: 5,
			totalTokens: 120,
			finishReason: 'stop',
			outputStarted: true,
			errorCategory: 'none' as const
		};

		first.record(record);
		await first.close();

		const second = await SqliteUsageStore.open(dbPath);
		try {
			expect(second.list()).toEqual([record]);
		} finally {
			await second.close();
		}
	});

	it('rejects unsafe usage record fragments before sqlite insert', async () => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-auth-usage-unsafe-'));
		const store = await SqliteUsageStore.open(path.join(dir, 'usage.sqlite'));

		try {
			expect(() =>
				store.record({
					id: 'usage_unsafe',
					timestamp: 1,
					latencyMs: 1,
					status: 'failed',
					cursorFacingModelId: 'gpt-5.4',
					upstreamModelId: 'gpt-5.5',
					requestShape: 'responses',
					localAccountKey: 'codex_local_fixture',
					outputStarted: false,
					errorCategory: 'provider',
					errorCode: 'prompt_leaked'
				})
			).toThrow('usage record contains unsafe fragment');
			expect(store.list()).toEqual([]);
		} finally {
			await store.close();
		}
	});
});

describe('assertSafeUsageRecord', () => {
	it('rejects prompt-like unsafe fragments', () => {
		expect(() =>
			assertSafeUsageRecord({
				id: 'usage_unsafe',
				timestamp: 1,
				latencyMs: 1,
				status: 'failed',
				cursorFacingModelId: 'gpt-5.4',
				upstreamModelId: null,
				requestShape: 'unsupported',
				localAccountKey: null,
				outputStarted: false,
				errorCategory: 'provider',
				errorCode: 'prompt_leaked'
			})
		).toThrow('usage record contains unsafe fragment');
	});
});
