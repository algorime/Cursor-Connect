import { createQuickTunnelStatus, type QuickTunnelStatus } from '@codex-auth-ext/shared';

export interface TunnelProcess {
	pid?: number;
	stdout?: AsyncIterable<string> | Iterable<string>;
	stderr?: AsyncIterable<string> | Iterable<string>;
	exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
	kill(signal?: NodeJS.Signals): void;
}

export interface QuickTunnelStartOptions {
	localTargetUrl: string;
	localApiKey?: string;
}

export interface QuickTunnelManagerOptions {
	spawn: (args: string[]) => TunnelProcess;
	startupTimeoutMs?: number;
	onStatusChange?: (status: QuickTunnelStatus) => void | Promise<void>;
}

const TRYCLOUDFLARE_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i;

export class QuickTunnelManager {
	private process: TunnelProcess | null = null;
	private currentUrl: string | null = null;
	private status: QuickTunnelStatus = createQuickTunnelStatus('not_started');

	constructor(private readonly options: QuickTunnelManagerOptions) {}

	getStatus(): QuickTunnelStatus {
		return structuredClone(this.status);
	}

	async start(start: QuickTunnelStartOptions): Promise<QuickTunnelStatus> {
		if (this.process) {
			return this.getStatus();
		}

		const startedProcess = this.options.spawn(['tunnel', '--url', start.localTargetUrl, '--no-autoupdate']);
		this.process = startedProcess;
		this.status = createQuickTunnelStatus('starting');
		const result = await this.readTunnelUrl(startedProcess);
		if (!result.url) {
			if (!result.exited) {
				startedProcess.kill('SIGTERM');
			}
			if (this.process === startedProcess) {
				this.process = null;
				this.currentUrl = null;
			}
			this.setStatus(result.exited
				? createQuickTunnelStatus('exited', null, `Quick Tunnel process exited before reporting a URL (${result.exitCode ?? result.signal ?? 'unknown'})`)
				: createQuickTunnelStatus('error', null, 'Quick Tunnel did not report a trycloudflare.com URL'));
			return this.getStatus();
		}

		this.currentUrl = result.url;
		this.setStatus(createQuickTunnelStatus('running', result.url));
		void startedProcess.exit.then(({ code, signal }) => {
			if (this.process === startedProcess) {
				this.process = null;
				this.currentUrl = null;
				this.setStatus(createQuickTunnelStatus('exited', null, `Quick Tunnel process exited (${signal ?? code ?? 'unknown'})`));
			}
		});
		return this.getStatus();
	}

	async restart(start: QuickTunnelStartOptions): Promise<QuickTunnelStatus> {
		const previousUrl = this.currentUrl;
		await this.stop();
		const status = await this.start(start);
		if (previousUrl && status.url && status.url !== previousUrl) {
			this.setStatus({ ...status, message: 'Quick Tunnel URL changed; update Cursor settings before relying on this route.' });
			return this.getStatus();
		}
		return status;
	}

	async stop(): Promise<QuickTunnelStatus> {
		if (this.process) {
			this.process.kill('SIGTERM');
		}
		this.process = null;
		this.currentUrl = null;
		this.setStatus(createQuickTunnelStatus('stopped'));
		return this.getStatus();
	}

	private setStatus(status: QuickTunnelStatus): void {
		this.status = status;
		void this.options.onStatusChange?.(this.getStatus());
	}

	private async readTunnelUrl(process: TunnelProcess): Promise<{ url: string | null; exited: boolean; exitCode?: number | null; signal?: NodeJS.Signals | null }> {
		let resolveResult: (result: { url: string | null; exited: boolean; exitCode?: number | null; signal?: NodeJS.Signals | null }) => void;
		const result = new Promise<{ url: string | null; exited: boolean; exitCode?: number | null; signal?: NodeJS.Signals | null }>((resolve) => {
			resolveResult = resolve;
		});
		let pendingStreams = streamCount(process.stdout, process.stderr);
		const inspectLine = (line: string): void => {
			const match = TRYCLOUDFLARE_URL.exec(line);
			if (match) {
				resolveResult({ url: match[0], exited: false });
			}
		};
		const consume = async (stream: AsyncIterable<string> | Iterable<string> | undefined): Promise<void> => {
			if (!stream) return;
			for await (const line of stream) {
				inspectLine(String(line));
			}
			pendingStreams -= 1;
			if (pendingStreams === 0) {
				resolveResult({ url: null, exited: false });
			}
		};

		void consume(process.stdout);
		void consume(process.stderr);
		void process.exit.then(({ code, signal }) => {
			resolveResult({ url: null, exited: true, exitCode: code, signal });
		});

		const timeoutMs = this.options.startupTimeoutMs ?? 30_000;
		const timeout = new Promise<{ url: string | null; exited: boolean }>((resolve) => {
			setTimeout(() => resolve({ url: null, exited: false }), timeoutMs);
		});

		return Promise.race([result, timeout]);
	}
}

function streamCount(...streams: Array<AsyncIterable<string> | Iterable<string> | undefined>): number {
	return streams.filter(Boolean).length;
}
