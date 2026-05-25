import { generateSecret } from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import {
	assertNoSecretsInLogLine,
	redactSecrets,
	SafeRuntimeLogger
} from '../src/logger/safe-logger.js';

describe('SafeRuntimeLogger', () => {
	it('redacts local api keys and internal control secrets from messages', () => {
		const logger = new SafeRuntimeLogger({ write: () => {} });
		const localApiKey = generateSecret();
		const internalSecret = generateSecret();

		const event = logger.log({
			component: 'supervisor',
			eventType: 'auth.failure',
			severity: 'warn',
			timestamp: Date.now(),
			category: 'auth',
			message: `auth failed localApiKey=${localApiKey} internalControlSecret=${internalSecret}`
		});

		expect(event.message).not.toContain(localApiKey);
		expect(event.message).not.toContain(internalSecret);
		expect(event.message).toContain('[REDACTED]');
	});

	it('never writes secret values to sink output', () => {
		const lines: string[] = [];
		const logger = new SafeRuntimeLogger({
			write: (line) => lines.push(line)
		});
		const localApiKey = generateSecret();
		const internalSecret = generateSecret();

		logger.log({
			component: 'supervisor',
			eventType: 'runtime.readiness_failed',
			severity: 'error',
			timestamp: Date.now(),
			category: 'readiness',
			message: 'readiness failed'
		});

		logger.log({
			component: 'supervisor',
			eventType: 'auth.failure',
			severity: 'warn',
			timestamp: Date.now(),
			category: 'auth',
			message: `bad localApiKey=${localApiKey}`
		});

		for (const line of lines) {
			assertNoSecretsInLogLine(line, [localApiKey, internalSecret]);
		}
	});

	it('redacts json secret fields', () => {
		const secret = generateSecret();
		const redacted = redactSecrets(`{"localApiKey":"${secret}"}`);

		expect(redacted).not.toContain(secret);
		expect(redacted).toContain('[REDACTED]');
	});
});
