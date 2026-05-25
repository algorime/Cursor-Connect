export const LOOPBACK_HOST = '127.0.0.1' as const;

export const PORT_RANGE_MIN = 49152;
export const PORT_RANGE_MAX = 65535;

export const LOCAL_API_KEY_HEADER = 'authorization' as const;
export const INTERNAL_CONTROL_HEADER = 'x-internal-control-secret' as const;

export const AUTH_FAILURE_BODY = {
	error: 'unauthorized'
} as const;

export const HEALTH_RESPONSE = {
	status: 'ok'
} as const;

export type RuntimePhase =
	| 'not_started'
	| 'starting'
	| 'running_health_only'
	| 'ready'
	| 'launch_failed'
	| 'port_unavailable'
	| 'health_failed'
	| 'readiness_failed'
	| 'internal_control_failed'
	| 'stopped';

export type RuntimeFailureCategory =
	| 'launch'
	| 'port'
	| 'health'
	| 'readiness'
	| 'internal_control'
	| 'none';

export interface RuntimeSnapshot {
	phase: RuntimePhase;
	failureCategory: RuntimeFailureCategory;
	localTargetUrl: string | null;
	port: number | null;
	message: string | null;
	updatedAt: number;
}

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export type SafeLogEventType =
	| 'runtime.starting'
	| 'runtime.ready'
	| 'runtime.stopped'
	| 'runtime.launch_failed'
	| 'runtime.port_unavailable'
	| 'runtime.health_failed'
	| 'runtime.readiness_failed'
	| 'runtime.internal_control_failed'
	| 'auth.failure'
	| 'process.spawned'
	| 'process.exited';

export interface SafeLogEvent {
	component: 'extension' | 'api' | 'supervisor' | 'port-manager';
	eventType: SafeLogEventType;
	severity: LogSeverity;
	timestamp: number;
	category?: RuntimeFailureCategory | 'auth';
	message: string;
	port?: number;
	exitCode?: number | null;
}

export interface ReadyResponse {
	ready: boolean;
}

export interface InternalControlPingResponse {
	ok: boolean;
}

export interface PortRuntimeState {
	port: number;
	host: string;
}

export function createInitialRuntimeSnapshot(): RuntimeSnapshot {
	return {
		phase: 'not_started',
		failureCategory: 'none',
		localTargetUrl: null,
		port: null,
		message: null,
		updatedAt: Date.now()
	};
}

export function buildLocalTargetUrl(host: string, port: number): string {
	return `http://${host}:${port}`;
}

export function generateSecret(byteLength = 32): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return Buffer.from(bytes).toString('base64url');
}

export function isRuntimePhaseTerminalFailure(phase: RuntimePhase): boolean {
	return (
		phase === 'launch_failed' ||
		phase === 'port_unavailable' ||
		phase === 'health_failed' ||
		phase === 'readiness_failed' ||
		phase === 'internal_control_failed'
	);
}

export const SECRET_FIELD_NAMES = [
	'localApiKey',
	'internalControlSecret',
	'authorization',
	'x-internal-control-secret',
	'token',
	'accessToken',
	'refreshToken',
	'oauthToken'
] as const;
