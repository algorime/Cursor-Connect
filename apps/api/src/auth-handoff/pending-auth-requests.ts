import type {
	AuthHandoffFailureCode,
	AuthHandoffResponse,
	AuthRequestReason,
	AuthRequestState,
	PendingAuthRequest
} from '@codex-auth-ext/shared';
import { generateSecret } from '@codex-auth-ext/shared';

interface PendingEntry {
	request: PendingAuthRequest;
	resolve: (response: AuthHandoffResponse) => void;
	timer: NodeJS.Timeout;
}

export interface PendingAuthQueueOptions {
	now?: () => number;
	requestTimeoutMs?: number;
}

export class PendingAuthQueue {
	private readonly now: () => number;
	private readonly requestTimeoutMs: number;
	private readonly entries = new Map<string, PendingEntry>();
	private readonly waitingPolls: Array<(request: PendingAuthRequest | null) => void> = [];
	private lastState: AuthRequestState = 'idle';
	private connectedPolls = 0;

	constructor(options: PendingAuthQueueOptions = {}) {
		this.now = options.now ?? Date.now;
		this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
	}

	getState(): AuthRequestState {
		return this.lastState;
	}

	hasConnectedPoll(): boolean {
		return this.connectedPolls > 0;
	}

	async requestAuth(reason: AuthRequestReason): Promise<AuthHandoffResponse> {
		const createdAt = this.now();
		const request: PendingAuthRequest = {
			id: generateSecret(16),
			reason,
			createdAt,
			deadlineAt: createdAt + this.requestTimeoutMs,
			state: 'request_pending'
		};

		this.setState('request_pending');

		const promise = new Promise<AuthHandoffResponse>((resolve) => {
			const timer = setTimeout(() => {
				this.entries.delete(request.id);
				this.setState('timed_out');
				resolve({
					ok: false,
					code: 'auth_handoff_timeout',
					message: 'auth handoff timed out'
				});
			}, this.requestTimeoutMs);

			this.entries.set(request.id, { request, resolve, timer });
		});

		this.deliverNext();

		return promise;
	}

	async poll(waitMs: number): Promise<PendingAuthRequest | null> {
		const immediate = this.getOldestPending();

		if (immediate) {
			this.markDelivered(immediate);
			return immediate;
		}

		this.connectedPolls += 1;
		this.setState('poll_connected');

		return new Promise((resolve) => {
			const done = (request: PendingAuthRequest | null): void => {
				clearTimeout(timer);
				this.connectedPolls = Math.max(0, this.connectedPolls - 1);
				if (this.connectedPolls === 0 && this.entries.size === 0) {
					this.setState('idle');
				}
				resolve(request);
			};

			const timer = setTimeout(() => done(null), waitMs);
			this.waitingPolls.push(done);
			this.deliverNext();
		});
	}

	respond(id: string, response: AuthHandoffResponse): boolean {
		const entry = this.entries.get(id);

		if (!entry || entry.request.state !== 'request_delivered') {
			return false;
		}

		clearTimeout(entry.timer);
		this.entries.delete(id);
		this.setState(response.ok ? 'response_received' : mapFailureState(response.code));
		entry.resolve(response);

		return true;
	}

	disconnect(): void {
		for (const done of this.waitingPolls.splice(0)) {
			done(null);
		}

		this.connectedPolls = 0;
		this.setState('control_disconnected');
	}

	complete(id: string): void {
		const entry = this.entries.get(id);

		if (!entry) {
			return;
		}

		clearTimeout(entry.timer);
		this.entries.delete(id);
		this.setState('cancelled_or_completed');
		entry.resolve({
			ok: false,
			code: 'control_shutting_down',
			message: 'auth request cancelled'
		});
	}

	private deliverNext(): void {
		const waiting = this.waitingPolls.shift();

		if (!waiting) {
			return;
		}

		const request = this.getOldestPending();

		if (!request) {
			this.waitingPolls.unshift(waiting);
			return;
		}

		this.markDelivered(request);
		waiting(request);
	}

	private getOldestPending(): PendingAuthRequest | null {
		for (const entry of this.entries.values()) {
			if (entry.request.state === 'request_pending') {
				return entry.request;
			}
		}

		return null;
	}

	private markDelivered(request: PendingAuthRequest): void {
		request.state = 'request_delivered';
		this.setState('request_delivered');
	}

	private setState(state: AuthRequestState): void {
		this.lastState = state;
	}
}

function mapFailureState(code: AuthHandoffFailureCode): AuthRequestState {
	if (code === 'auth_required' || code === 'auth_unavailable') {
		return 'auth_required';
	}

	if (code === 'auth_refresh_failed') {
		return 'refresh_failed';
	}

	if (code === 'control_shutting_down') {
		return 'control_disconnected';
	}

	return 'timed_out';
}
