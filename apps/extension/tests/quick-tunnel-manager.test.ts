import { describe, expect, it } from 'vitest';

import { QuickTunnelManager, type TunnelProcess } from '../src/setup/quick-tunnel-manager.js';

function processWithLines(lines: string[]): TunnelProcess {
	return {
		pid: 123,
		stdout: lines,
		stderr: [],
		exit: new Promise(() => undefined),
		kill: () => undefined
	};
}

describe('QuickTunnelManager', () => {
	it('parses trycloudflare URLs and keeps streaming caveat explicit', async () => {
		const manager = new QuickTunnelManager({
			spawn: () => processWithLines(['Your quick Tunnel has been created! https://abc.trycloudflare.com'])
		});

		const status = await manager.start({ localTargetUrl: 'http://127.0.0.1:50000' });

		expect(status).toMatchObject({
			state: 'running',
			url: 'https://abc.trycloudflare.com',
			temporary: true,
			streamingUnsupportedOrUnverified: true
		});
	});

	it('marks URL changes as repair-required without leaking secrets in diagnostics', async () => {
		let url = 'https://first.trycloudflare.com';
		const manager = new QuickTunnelManager({
			spawn: () => processWithLines([`url ${url}`])
		});

		await manager.start({ localTargetUrl: 'http://127.0.0.1:50000', localApiKey: 'secret-key' });
		url = 'https://second.trycloudflare.com';
		const restarted = await manager.restart({ localTargetUrl: 'http://127.0.0.1:50000', localApiKey: 'secret-key' });

		expect(restarted).toMatchObject({ url: 'https://second.trycloudflare.com', message: expect.stringMatching(/Cursor settings/i) });
		expect(JSON.stringify(restarted)).not.toContain('secret-key');
	});

	it('stops the running tunnel process', async () => {
		let killed = false;
		const manager = new QuickTunnelManager({
			spawn: () => ({ ...processWithLines(['https://abc.trycloudflare.com']), kill: () => { killed = true; } })
		});

		await manager.start({ localTargetUrl: 'http://127.0.0.1:50000' });
		const stopped = await manager.stop();

		expect(killed).toBe(true);
		expect(stopped).toMatchObject({ state: 'stopped', url: null });
	});

	it('clears failed startup process state and can retry', async () => {
		let calls = 0;
		let failedStartupKilled = false;
		const manager = new QuickTunnelManager({
			spawn: () => {
				calls += 1;
				return calls === 1
					? { ...processWithLines(['no public url here']), kill: () => { failedStartupKilled = true; } }
					: processWithLines(['https://retry.trycloudflare.com']);
			}
		});

		await expect(manager.start({ localTargetUrl: 'http://127.0.0.1:50000' })).resolves.toMatchObject({ state: 'error' });
		expect(failedStartupKilled).toBe(true);
		await expect(manager.start({ localTargetUrl: 'http://127.0.0.1:50000' })).resolves.toMatchObject({
			state: 'running',
			url: 'https://retry.trycloudflare.com'
		});
	});

	it('classifies process exit before URL as exited', async () => {
		const manager = new QuickTunnelManager({
			spawn: () => ({
				pid: 123,
				stdout: pendingLines(),
				stderr: pendingLines(),
				exit: Promise.resolve({ code: 1, signal: null }),
				kill: () => undefined
			})
		});

		await expect(manager.start({ localTargetUrl: 'http://127.0.0.1:50000' })).resolves.toMatchObject({
			state: 'exited',
			message: expect.stringMatching(/exited/i)
		});
	});

	it('notifies consumers when a running tunnel exits asynchronously', async () => {
		let resolveExit: (value: { code: number | null; signal: NodeJS.Signals | null }) => void = () => undefined;
		const changes: string[] = [];
		const manager = new QuickTunnelManager({
			spawn: () => ({
				pid: 123,
				stdout: ['https://abc.trycloudflare.com'],
				stderr: [],
				exit: new Promise((resolve) => {
					resolveExit = resolve;
				}),
				kill: () => undefined
			}),
			onStatusChange: (status) => {
				changes.push(status.state);
			}
		});

		await manager.start({ localTargetUrl: 'http://127.0.0.1:50000' });
		resolveExit({ code: 1, signal: null });
		await Promise.resolve();

		expect(changes).toContain('running');
		expect(changes).toContain('exited');
		expect(manager.getStatus()).toMatchObject({ state: 'exited', url: null });
	});
});

async function* pendingLines(): AsyncIterable<string> {
	await new Promise(() => undefined);
}
