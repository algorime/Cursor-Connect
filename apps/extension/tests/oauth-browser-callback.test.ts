import { describe, expect, it } from 'vitest';

import { prepareOAuthCallbackForBrowser } from '../src/codex-auth/oauth-browser-callback.js';

describe('prepareOAuthCallbackForBrowser', () => {
	it('asks the editor to expose the fixed Codex callback URI before browser OAuth', async () => {
		const calls: string[] = [];
		const result = await prepareOAuthCallbackForBrowser('http://localhost:1455/auth/callback', {
			parseUri: (value) => new URL(value),
			asExternalUri: async (uri) => {
				calls.push(uri.toString());
				return new URL('http://localhost:1455/auth/callback');
			}
		});

		expect(calls).toEqual(['http://localhost:1455/auth/callback']);
		expect(result).toEqual({
			prepared: true,
			compatibleWithFixedRedirect: true,
			externalUri: 'http://localhost:1455/auth/callback'
		});
	});

	it('reports an incompatible tunnel when the editor cannot expose localhost on the fixed port', async () => {
		const result = await prepareOAuthCallbackForBrowser('http://localhost:1455/auth/callback', {
			parseUri: (value) => new URL(value),
			asExternalUri: async () => new URL('http://localhost:49152/auth/callback')
		});

		expect(result).toMatchObject({
			prepared: true,
			compatibleWithFixedRedirect: false
		});
	});
});
