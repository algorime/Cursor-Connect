import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SpawnRequest {
	runtimePath: string;
	env: NodeJS.ProcessEnv;
}

export interface ManagedProcess {
	pid: number | undefined;
	kill(signal?: NodeJS.Signals): void;
	onExit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export interface ProcessSpawner {
	spawn(request: SpawnRequest): ManagedProcess;
}

export interface ApiBundlePaths {
	apiEntryPath: string;
	cwd: string;
}

export class NodeProcessSpawner implements ProcessSpawner {
	constructor(
		private readonly apiEntryPath: string,
		private readonly cwd: string
	) {}

	spawn(request: SpawnRequest): ManagedProcess {
		const child = cp.spawn(request.runtimePath, [this.apiEntryPath], {
			cwd: this.cwd,
			env: request.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: false
		});

		child.stdout?.on('data', (chunk: Buffer) => {
			process.stdout.write(chunk);
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			process.stderr.write(chunk);
		});

		const onExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
			child.once('exit', (code, signal) => {
				resolve({ code, signal });
			});
		});

		return {
			pid: child.pid,
			kill(signal = 'SIGTERM') {
				if (child.pid) {
					child.kill(signal);
				}
			},
			onExit
		};
	}
}

export class BundledApiProcessSpawner implements ProcessSpawner {
	constructor(
		private readonly extensionPath: string,
		private readonly devMode: boolean
	) {}

	spawn(request: SpawnRequest): ManagedProcess {
		const { apiEntryPath, cwd } = resolveApiBundlePaths(this.extensionPath, this.devMode);

		return new NodeProcessSpawner(apiEntryPath, cwd).spawn(request);
	}
}

export function resolveNodeRuntime(explicitPath?: string): string {
	if (explicitPath && fs.existsSync(explicitPath)) {
		return explicitPath;
	}

	return process.execPath;
}

export function resolveApiBundlePaths(extensionPath: string, devMode: boolean): ApiBundlePaths {
	if (devMode) {
		const devEntry = path.join(extensionPath, '..', 'api', 'dist', 'main.js');

		if (fs.existsSync(devEntry)) {
			return {
				apiEntryPath: devEntry,
				cwd: path.join(extensionPath, '..', 'api')
			};
		}
	}

	const packagedEntry = path.join(extensionPath, 'api', 'bundle', 'main.cjs');
	const packagedCwd = path.join(extensionPath, 'api', 'bundle');

	if (fs.existsSync(packagedEntry)) {
		return {
			apiEntryPath: packagedEntry,
			cwd: packagedCwd
		};
	}

	const siblingEntry = path.join(extensionPath, '..', 'api', 'bundle', 'main.cjs');
	const siblingCwd = path.join(extensionPath, '..', 'api', 'bundle');

	if (fs.existsSync(siblingEntry)) {
		return {
			apiEntryPath: siblingEntry,
			cwd: siblingCwd
		};
	}

	throw new Error('api bundle not found');
}

/** @deprecated Use resolveApiBundlePaths */
export function resolveApiBundlePath(extensionPath: string, devMode: boolean): string {
	return resolveApiBundlePaths(extensionPath, devMode).apiEntryPath;
}

/** @deprecated Use resolveApiBundlePaths */
export function resolveApiCwd(extensionPath: string, devMode: boolean): string {
	return resolveApiBundlePaths(extensionPath, devMode).cwd;
}
