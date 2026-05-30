import {
	INTERNAL_CONTROL_HEADER,
	type AuthHandoffResponse,
	type CodexAuthState,
	type InternalStatusResponse,
	type PendingAuthRequest,
	type ReadyResponse,
	type RuntimeSnapshot
} from '@codex-auth-ext/shared';

import type { CredentialStore } from './credentials.js';
import type { PortManager } from './port-manager.js';
import {
	BundledApiProcessSpawner,
	resolveNodeRuntime,
	type ManagedProcess,
	type ProcessSpawner
} from './process-spawner.js';
import { RuntimeStateModel } from './runtime-state.js';
import type { SafeRuntimeLogger } from '../logger/safe-logger.js';

export interface RuntimeSupervisorOptions {
	extensionPath: string;
	devMode?: boolean;
	portManager: PortManager;
	credentials: CredentialStore;
	logger: SafeRuntimeLogger;
	spawner?: ProcessSpawner;
	runtimePath?: string;
	healthTimeoutMs?: number;
	readinessTimeoutMs?: number;
	internalControlTimeoutMs?: number;
	pollIntervalMs?: number;
	fetchImpl?: typeof fetch;
	authHandoffResponder?: (request: PendingAuthRequest) => Promise<AuthHandoffResponse>;
	getCodexAuthState?: () => Promise<CodexAuthState>;
	modelRoutingWorkaroundEnabled?: () => boolean;
	requireReadyOnStart?: boolean;
	fakeCodexScenario?: string;
	usageDbPath?: string;
	runtimeId?: string;
}

export interface RuntimeStatusView {
	snapshot: RuntimeSnapshot;
}

export class RuntimeSupervisor {
	private readonly extensionPath: string;
	private readonly devMode: boolean;
	private readonly portManager: PortManager;
	private readonly credentials: CredentialStore;
	private readonly logger: SafeRuntimeLogger;
	private readonly spawner: ProcessSpawner;
	private readonly runtimePath: string;
	private readonly healthTimeoutMs: number;
	private readonly readinessTimeoutMs: number;
	private readonly internalControlTimeoutMs: number;
	private readonly pollIntervalMs: number;
	private readonly fetchImpl: typeof fetch;
	private readonly authHandoffResponder: (request: PendingAuthRequest) => Promise<AuthHandoffResponse>;
	private readonly getCodexAuthState: () => Promise<CodexAuthState>;
	private readonly modelRoutingWorkaroundEnabled: () => boolean;
	private readonly requireReadyOnStart: boolean;
	private readonly fakeCodexScenario?: string;
	private readonly usageDbPath?: string;
	private readonly runtimeId: string;
	private readonly state = new RuntimeStateModel();
	private authPollAbort: AbortController | null = null;

	private process: ManagedProcess | null = null;
	private starting = false;
	private restartRequested = false;
	private stopped = false;

	constructor(options: RuntimeSupervisorOptions) {
		this.extensionPath = options.extensionPath;
		this.devMode = options.devMode ?? false;
		this.portManager = options.portManager;
		this.credentials = options.credentials;
		this.logger = options.logger;
		this.runtimePath = resolveNodeRuntime(options.runtimePath);
		this.spawner =
			options.spawner ?? new BundledApiProcessSpawner(this.extensionPath, this.devMode);
		this.healthTimeoutMs = options.healthTimeoutMs ?? 10_000;
		this.readinessTimeoutMs = options.readinessTimeoutMs ?? 10_000;
		this.internalControlTimeoutMs = options.internalControlTimeoutMs ?? 10_000;
		this.pollIntervalMs = options.pollIntervalMs ?? 100;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.authHandoffResponder =
			options.authHandoffResponder ??
			(async () => ({
				ok: false,
				code: 'auth_required',
				message: 'Codex auth is required'
			}));
		this.getCodexAuthState = options.getCodexAuthState ?? (async () => 'not_configured');
		this.modelRoutingWorkaroundEnabled = options.modelRoutingWorkaroundEnabled ?? (() => false);
		this.requireReadyOnStart = options.requireReadyOnStart ?? false;
		this.fakeCodexScenario = options.fakeCodexScenario;
		this.usageDbPath = options.usageDbPath;
		this.runtimeId = options.runtimeId ?? crypto.randomUUID();
	}

	getStatus(): RuntimeStatusView {
		return {
			snapshot: this.state.getSnapshot()
		};
	}

	async start(): Promise<RuntimeSnapshot> {
		if (this.starting || this.process) {
			return this.state.getSnapshot();
		}

		this.starting = true;
		this.stopped = false;
		this.state.setPhase('starting');

		this.logger.log({
			component: 'supervisor',
			eventType: 'runtime.starting',
			severity: 'info',
			timestamp: Date.now(),
			message: 'runtime supervisor starting'
		});

		try {
			const portResult = await this.portManager.resolvePort();

			if (!portResult.ok) {
				return this.fail('port_unavailable', 'port', 'persisted loopback port unavailable; repair required', {
					port: portResult.state?.port ?? null,
					localTargetUrl: portResult.state
						? this.portManager.getLocalTargetUrl(portResult.state)
						: null
				});
			}

			const { state: portState } = portResult;
			const localTargetUrl = this.portManager.getLocalTargetUrl(portState);
			const localApiKey = await this.credentials.getLocalApiKey();
			const internalControlSecret = await this.credentials.getInternalControlSecret();

			const managed = this.spawnProcess(portState.port, localApiKey, internalControlSecret, portState.host);
			this.process = managed;

			this.logger.log({
				component: 'supervisor',
				eventType: 'process.spawned',
				severity: 'info',
				timestamp: Date.now(),
				message: 'api process spawned',
				port: portState.port
			});

			void managed.onExit.then(({ code, signal }) => {
				this.handleProcessExit(code, signal);
			});

			const healthResult = await this.waitForHealth(localTargetUrl, managed);

			if (healthResult === 'process_exited') {
				await this.stopProcess();
				return this.fail(
					'launch_failed',
					'launch',
					'api process exited before becoming healthy',
					{
						port: portState.port,
						localTargetUrl
					}
				);
			}

			if (healthResult === 'timeout') {
				await this.stopProcess();
				return this.fail('health_failed', 'health', 'api health check failed or timed out', {
					port: portState.port,
					localTargetUrl
					});
			}

			this.state.setPhase('running_health_only', {
				port: portState.port,
				localTargetUrl,
				runtimeId: this.runtimeId
			});

			const controlOk = await this.verifyInternalControl(localTargetUrl, internalControlSecret);

			if (!controlOk) {
				await this.stopProcess();
				return this.fail('internal_control_failed', 'internal_control', 'internal control channel verification failed', {
					port: portState.port,
					localTargetUrl
				});
			}

			this.startAuthPollLoop(localTargetUrl, internalControlSecret);
			await this.publishAuthStatus(localTargetUrl, internalControlSecret);

			const readyOk = await this.waitForReady(localTargetUrl, localApiKey);

			if (!readyOk) {
				if (this.requireReadyOnStart) {
					await this.stopProcess();
					return this.fail('readiness_failed', 'readiness', 'authenticated readiness check failed or timed out', {
						port: portState.port,
						localTargetUrl
					});
				}

				return this.state.setPhase('running_health_only', {
					port: portState.port,
					localTargetUrl,
					message: 'Codex auth required'
				});
			}

			return this.state.setPhase('ready', {
				port: portState.port,
				localTargetUrl
					});
		} catch (error) {
			await this.stopProcess();
			const message = error instanceof Error ? error.message : 'runtime launch failed';

			return this.fail('launch_failed', 'launch', message);
		} finally {
			this.starting = false;
		}
	}

	async getLocalApiKeyForTests(): Promise<string> {
		return this.credentials.getLocalApiKey();
	}

	getRuntimeId(): string {
		return this.runtimeId;
	}

	async getInternalStatus(): Promise<InternalStatusResponse | null> {
		const snapshot = this.state.getSnapshot();
		if (!snapshot.localTargetUrl) {
			return null;
		}

		const internalControlSecret = await this.credentials.getInternalControlSecret();
		try {
			const response = await this.fetchImpl(`${snapshot.localTargetUrl}/internal/status`, {
				headers: {
					[INTERNAL_CONTROL_HEADER]: internalControlSecret
				}
			});
			if (!response.ok) {
				return null;
			}
			return (await response.json()) as InternalStatusResponse;
		} catch {
			return null;
		}
	}

	async restart(): Promise<RuntimeSnapshot> {
		this.restartRequested = true;
		await this.stop();
		this.restartRequested = false;

		return this.start();
	}

	async stop(): Promise<RuntimeSnapshot> {
		this.stopped = true;
		await this.stopProcess();

		return this.state.setPhase('stopped');
	}

	private spawnProcess(
		port: number,
		localApiKey: string,
		internalControlSecret: string,
		host: string
	): ManagedProcess {
		return this.spawner.spawn({
			runtimePath: this.runtimePath,
			env: {
				...process.env,
				CODEX_AUTH_EXT_PORT: String(port),
				CODEX_AUTH_EXT_HOST: host,
				CODEX_AUTH_EXT_LOCAL_API_KEY: localApiKey,
				CODEX_AUTH_EXT_INTERNAL_CONTROL_SECRET: internalControlSecret,
				CODEX_AUTH_EXT_GPT54_TO_GPT55_WORKAROUND: this.modelRoutingWorkaroundEnabled() ? '1' : '0',
				CODEX_AUTH_EXT_FAKE_CODEX_SCENARIO: this.fakeCodexScenario ?? '',
				CODEX_AUTH_EXT_USAGE_DB_PATH: this.usageDbPath ?? '',
				CODEX_AUTH_EXT_RUNTIME_ID: this.runtimeId
			}
		});
	}

	private async stopProcess(): Promise<void> {
		this.authPollAbort?.abort();
		this.authPollAbort = null;

		if (!this.process) {
			return;
		}

		const current = this.process;
		this.process = null;
		current.kill('SIGTERM');

		await Promise.race([
			current.onExit,
			new Promise((resolve) => setTimeout(resolve, 2_000))
		]);
	}

	private async waitForHealth(
		localTargetUrl: string,
		managed: ManagedProcess
	): Promise<'healthy' | 'process_exited' | 'timeout'> {
		let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;

		void managed.onExit.then((info) => {
			exitInfo = info;
		});

		const deadline = Date.now() + this.healthTimeoutMs;

		while (Date.now() < deadline) {
			if (exitInfo) {
				return 'process_exited';
			}

			try {
				const response = await this.fetchImpl(`${localTargetUrl}/health`);

				if (response.ok) {
					const body = (await response.json()) as { status?: string };

					if (body.status === 'ok') {
						return 'healthy';
					}
				}
			} catch {
				// keep polling
			}

			await sleep(this.pollIntervalMs);
		}

		return exitInfo ? 'process_exited' : 'timeout';
	}

	private async waitForReady(localTargetUrl: string, localApiKey: string): Promise<boolean> {
		const deadline = Date.now() + this.readinessTimeoutMs;

		while (Date.now() < deadline) {
			try {
				const response = await this.fetchImpl(`${localTargetUrl}/ready`, {
					headers: {
						authorization: `Bearer ${localApiKey}`
					}
				});

				if (response.ok) {
					const body = (await response.json()) as ReadyResponse;

					if (body.ready) {
						return true;
					}
				}
			} catch {
				// keep polling
			}

			await sleep(this.pollIntervalMs);
		}

		return false;
	}

	private async verifyInternalControl(
		localTargetUrl: string,
		internalControlSecret: string
	): Promise<boolean> {
		const deadline = Date.now() + this.internalControlTimeoutMs;

		while (Date.now() < deadline) {
			try {
				const response = await this.fetchImpl(`${localTargetUrl}/internal/control/ping`, {
					headers: {
						[INTERNAL_CONTROL_HEADER]: internalControlSecret
					}
				});

				if (response.ok) {
					return true;
				}
			} catch {
				// keep polling
			}

			await sleep(this.pollIntervalMs);
		}

		return false;
	}

	private startAuthPollLoop(localTargetUrl: string, internalControlSecret: string): void {
		this.authPollAbort?.abort();
		const abort = new AbortController();
		this.authPollAbort = abort;

		void this.runAuthPollLoop(localTargetUrl, internalControlSecret, abort.signal);
	}

	private async publishAuthStatus(
		localTargetUrl: string,
		internalControlSecret: string
	): Promise<void> {
		await this.fetchImpl(`${localTargetUrl}/internal/auth/status`, {
			method: 'POST',
			headers: {
				[INTERNAL_CONTROL_HEADER]: internalControlSecret,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				codexAuthState: await this.getCodexAuthState()
			})
		});
	}

	private async runAuthPollLoop(
		localTargetUrl: string,
		internalControlSecret: string,
		signal: AbortSignal
	): Promise<void> {
		while (!signal.aborted) {
			try {
				const response = await this.fetchImpl(`${localTargetUrl}/internal/auth-requests?waitMs=1000`, {
					headers: {
						[INTERNAL_CONTROL_HEADER]: internalControlSecret
					},
					signal
				});

				if (!response.ok) {
					await sleep(250);
					continue;
				}

				const body = (await response.json()) as { request?: PendingAuthRequest | null };
				if (!body.request?.id) {
					continue;
				}

				const handoffResponse = await this.authHandoffResponder(body.request);

				await this.fetchImpl(`${localTargetUrl}/internal/auth-requests/${body.request.id}/response`, {
					method: 'POST',
					headers: {
						[INTERNAL_CONTROL_HEADER]: internalControlSecret,
						'content-type': 'application/json'
					},
					body: JSON.stringify(handoffResponse),
					signal
				});
			} catch {
				if (!signal.aborted) {
					await sleep(250);
				}
			}
		}
	}

	private async handleProcessExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
		this.process = null;

		this.logger.log({
			component: 'supervisor',
			eventType: 'process.exited',
			severity: code === 0 ? 'info' : 'error',
			timestamp: Date.now(),
			message: 'api process exited',
			exitCode: code,
			category: code === 0 ? 'none' : 'launch'
		});

		if (this.stopped) {
			this.state.setPhase('stopped');
			return;
		}

		if (this.restartRequested) {
			return;
		}

		if (this.starting) {
			return;
		}

		this.fail('launch_failed', 'launch', `api process exited (${signal ?? code ?? 'unknown'})`);
	}

	private fail(
		phase: Extract<
			RuntimeSnapshot['phase'],
			'launch_failed' | 'port_unavailable' | 'health_failed' | 'readiness_failed' | 'internal_control_failed'
		>,
		category: RuntimeSnapshot['failureCategory'],
		message: string,
		details?: {
			port?: number | null;
			localTargetUrl?: string | null;
		}
	): RuntimeSnapshot {
		const eventType =
			phase === 'port_unavailable'
				? 'runtime.port_unavailable'
				: phase === 'health_failed'
					? 'runtime.health_failed'
					: phase === 'readiness_failed'
						? 'runtime.readiness_failed'
						: phase === 'internal_control_failed'
							? 'runtime.internal_control_failed'
							: 'runtime.launch_failed';

		this.logger.log({
			component: 'supervisor',
			eventType,
			severity: 'error',
			timestamp: Date.now(),
			category,
			message,
			port: details?.port ?? undefined
		});

		return this.state.setPhase(phase, {
			failureCategory: category,
			message,
			port: details?.port ?? null,
			localTargetUrl: details?.localTargetUrl ?? null
		});
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export { sleep };
