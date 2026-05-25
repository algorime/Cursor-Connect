import { startApiServer, type ApiServerHandle } from '@codex-auth-ext/api/server';

import type { ManagedProcess, ProcessSpawner, SpawnRequest } from '../../src/runtime/process-spawner.js';

export class InProcessApiSpawner implements ProcessSpawner {
	private readonly handles = new Set<ApiServerHandle>();

	spawn(request: SpawnRequest): ManagedProcess {
		const port = Number(request.env.CODEX_AUTH_EXT_PORT);
		const localApiKey = String(request.env.CODEX_AUTH_EXT_LOCAL_API_KEY ?? '');
		const internalControlSecret = String(request.env.CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET ?? '');
		const host = String(request.env.CODEX_AUTH_EXT_HOST ?? '127.0.0.1');
		const handles = this.handles;

		let handle: ApiServerHandle | null = null;
		let exitResolve: ((value: { code: number | null; signal: NodeJS.Signals | null }) => void) | null =
			null;

		const onExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
			exitResolve = resolve;
		});

		void startApiServer({
			host,
			port,
			localApiKey,
			internalControlSecret
		})
			.then((started) => {
				handle = started;
				handles.add(started);
			})
			.catch(() => {
				exitResolve?.({ code: 1, signal: null });
			});

		return {
			pid: port,
			kill() {
				if (handle) {
					const current = handle;
					void current.app.close().finally(() => {
						handles.delete(current);
						exitResolve?.({ code: 0, signal: 'SIGTERM' });
					});
				} else {
					exitResolve?.({ code: 1, signal: 'SIGTERM' });
				}
			},
			onExit
		};
	}

	async closeAll(): Promise<void> {
		await Promise.all([...this.handles].map((handle) => handle.app.close()));
		this.handles.clear();
	}
}

export class FailingProcessSpawner implements ProcessSpawner {
	spawn(_request: SpawnRequest): ManagedProcess {
		return {
			pid: undefined,
			kill() {},
			onExit: Promise.resolve({ code: 1, signal: null })
		};
	}
}

export class BrokenHealthProcessSpawner implements ProcessSpawner {
	spawn(_request: SpawnRequest): ManagedProcess {
		let exitResolve: ((value: { code: number | null; signal: NodeJS.Signals | null }) => void) | null =
			null;
		const onExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
			exitResolve = resolve;
		});

		return {
			pid: 999,
			kill() {
				exitResolve?.({ code: 0, signal: 'SIGTERM' });
			},
			onExit
		};
	}
}
