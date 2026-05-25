import http from 'node:http';

export interface OAuthCallbackResult {
	code: string;
	state: string;
}

export async function waitForOAuthCallback(options: {
	state: string;
	timeoutMs?: number;
}): Promise<{ redirectUri: string; waitForCallback: Promise<OAuthCallbackResult>; dispose: () => Promise<void> }> {
	const timeoutMs = options.timeoutMs ?? 120_000;
	const server = http.createServer();
	let settled = false;

	const waitForCallback = new Promise<OAuthCallbackResult>((resolve, reject) => {
		const timeout = setTimeout(() => {
			if (!settled) {
				settled = true;
				reject(new Error('Codex OAuth timed out'));
			}
		}, timeoutMs);

		server.on('request', (request, response) => {
			const url = new URL(request.url ?? '/', 'http://127.0.0.1');
			const code = url.searchParams.get('code');
			const state = url.searchParams.get('state');

			if (!code || state !== options.state) {
				response.statusCode = 400;
				response.end('Codex sign-in failed. You can close this tab.');
				if (!settled) {
					settled = true;
					clearTimeout(timeout);
					reject(new Error('Codex OAuth callback was invalid'));
				}
				return;
			}

			response.statusCode = 200;
			response.end('Codex sign-in complete. You can close this tab.');
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				resolve({ code, state });
			}
		});
	});

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});

	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Codex OAuth callback server did not bind');
	}

	return {
		redirectUri: `http://127.0.0.1:${address.port}/callback`,
		waitForCallback,
		dispose: async () => {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	};
}
