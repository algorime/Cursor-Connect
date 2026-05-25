import net from 'node:net';

import {
	buildLocalTargetUrl,
	LOOPBACK_HOST,
	PORT_RANGE_MAX,
	PORT_RANGE_MIN,
	type PortRuntimeState
} from '@codex-auth-ext/shared';

export interface PortStore {
	read(): Promise<PortRuntimeState | null>;
	write(state: PortRuntimeState): Promise<void>;
}

export interface PortAvailabilityChecker {
	isPortAvailable(host: string, port: number): Promise<boolean>;
}

export class NetPortAvailabilityChecker implements PortAvailabilityChecker {
	async isPortAvailable(host: string, port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const server = net.createServer();

			server.once('error', () => {
				resolve(false);
			});

			server.once('listening', () => {
				server.close(() => resolve(true));
			});

			server.listen({ host, port });
		});
	}
}

export type PortSelectionResult =
	| {
			ok: true;
			state: PortRuntimeState;
			repairRequired: false;
	  }
	| {
			ok: false;
			state: PortRuntimeState | null;
			repairRequired: true;
			reason: 'port_unavailable';
	  };

export interface PortManagerOptions {
	host?: string;
	store: PortStore;
	checker?: PortAvailabilityChecker;
	random?: () => number;
	maxAttempts?: number;
}

export class PortManager {
	private readonly host: string;
	private readonly store: PortStore;
	private readonly checker: PortAvailabilityChecker;
	private readonly random: () => number;
	private readonly maxAttempts: number;

	constructor(options: PortManagerOptions) {
		this.host = options.host ?? LOOPBACK_HOST;
		this.store = options.store;
		this.checker = options.checker ?? new NetPortAvailabilityChecker();
		this.random = options.random ?? Math.random;
		this.maxAttempts = options.maxAttempts ?? 100;
	}

	async resolvePort(): Promise<PortSelectionResult> {
		const existing = await this.store.read();

		if (existing) {
			const available = await this.checker.isPortAvailable(this.host, existing.port);

			if (!available) {
				return {
					ok: false,
					state: existing,
					repairRequired: true,
					reason: 'port_unavailable'
				};
			}

			return {
				ok: true,
				state: existing,
				repairRequired: false
			};
		}

		for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
			const port = this.pickRandomPort();
			const available = await this.checker.isPortAvailable(this.host, port);

			if (!available) {
				continue;
			}

			const state: PortRuntimeState = {
				host: this.host,
				port
			};

			await this.store.write(state);

			return {
				ok: true,
				state,
				repairRequired: false
			};
		}

		return {
			ok: false,
			state: null,
			repairRequired: true,
			reason: 'port_unavailable'
		};
	}

	getLocalTargetUrl(state: PortRuntimeState): string {
		return buildLocalTargetUrl(state.host, state.port);
	}

	private pickRandomPort(): number {
		const span = PORT_RANGE_MAX - PORT_RANGE_MIN + 1;

		return PORT_RANGE_MIN + Math.floor(this.random() * span);
	}
}
