import type { ApiTrafficStatus } from './api-runtime.js';
export const LOOPBACK_HOST = '127.0.0.1' as const;

export const PORT_RANGE_MIN = 49152;
export const PORT_RANGE_MAX = 65535;

export const LOCAL_API_KEY_HEADER = 'authorization' as const;
export const INTERNAL_CONTROL_HEADER = 'x-internal-control-secret' as const;

export const AUTH_FAILURE_BODY = {
	error: 'unauthorized'
} as const;

export const OPENAI_ERROR_BODY = {
	error: {
		message: 'request failed',
		type: 'invalid_request_error',
		code: 'request_failed'
	}
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
	runtimeId?: string;
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
	| 'api.request'
	| 'api.response'
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
	method?: string;
	path?: string;
	hasAuthHeader?: boolean;
	userAgent?: string | null;
	requestId?: string | null;
	statusCode?: number;
	errorCategory?: string;
	errorCode?: string;
	upstreamStatus?: number;
	refreshedAfter401?: boolean;
}

export interface ReadyResponse {
	ready: boolean;
	runtimeId?: string;
}

export interface InternalControlPingResponse {
	ok: boolean;
}

export type CursorFacingModelId = string;
export type UpstreamModelId = string;

export type ModelPolicyState =
	| 'ready'
	| 'workaround_enabled'
	| 'workaround_disabled'
	| 'routing_not_verified'
	| 'protocol_shape_changed';

export interface CodexModelEntry {
	id: CursorFacingModelId;
	object: 'model';
	owned_by: 'codex-auth-first';
	upstreamModelId: UpstreamModelId;
	supported: boolean;
	recommended: boolean;
	workaroundRequired: boolean;
	policyState: ModelPolicyState;
}

export interface ModelsResponse {
	object: 'list';
	data: CodexModelEntry[];
}

export type CodexAuthState =
	| 'not_configured'
	| 'authenticated'
	| 'auth_required'
	| 'auth_refresh_failed'
	| 'account_id_missing'
	| 'oauth_unavailable'
	| 'import_available';

export type ProxyState =
	| 'proxy_ready'
	| 'auth_not_ready'
	| 'control_disconnected'
	| 'protocol_unavailable'
	| 'storage_degraded';

export interface InternalStatusResponse {
	runtimeId?: string;
	traffic: ApiTrafficStatus;
	controlConfigured: boolean;
	controlAuthenticated: boolean;
	authHandoffConnected: boolean;
	codexAuthState: CodexAuthState;
	modelPolicyState: ModelPolicyState;
	proxyState: ProxyState;
	usageStorageState?: 'ready' | 'degraded';
}

export type AuthRequestReason = 'normal' | 'forced_refresh_after_401';

export type AuthRequestState =
	| 'idle'
	| 'poll_connected'
	| 'request_pending'
	| 'request_delivered'
	| 'response_received'
	| 'timed_out'
	| 'auth_required'
	| 'refresh_failed'
	| 'control_disconnected'
	| 'cancelled_or_completed';

export interface PendingAuthRequest {
	id: string;
	reason: AuthRequestReason;
	deadlineAt: number;
	createdAt: number;
	state: AuthRequestState;
}

export interface AuthPollResponse {
	request: PendingAuthRequest | null;
}

export interface RequestScopedAuthContext {
	accessToken: string;
	expiresAt: number;
	localAccountKey: string;
	accountLabel?: string;
	accountFingerprint?: string;
	upstreamHeaders?: Record<string, string>;
}

export type AuthHandoffFailureCode =
	| 'auth_required'
	| 'auth_refresh_failed'
	| 'account_id_missing'
	| 'auth_unavailable'
	| 'auth_handoff_timeout'
	| 'control_shutting_down';

export type AuthHandoffResponse =
	| {
			ok: true;
			context: RequestScopedAuthContext;
	  }
	| {
			ok: false;
			code: AuthHandoffFailureCode;
			message: string;
	  };

export interface ChatCompletionChunk {
	id: string;
	object: 'chat.completion.chunk';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: Record<string, unknown>;
		finish_reason: string | null;
	}>;
	usage?: TokenUsage | null;
}

export interface TokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
	prompt_tokens_details?: {
		cached_tokens?: number;
	};
	completion_tokens_details?: {
		reasoning_tokens?: number;
	};
}

export type UsageStatus = 'completed' | 'failed';
export type SafeErrorCategory =
	| 'none'
	| 'auth'
	| 'quota'
	| 'rate_limit'
	| 'context_length'
	| 'invalid_request'
	| 'provider'
	| 'stream'
	| 'service_not_ready'
	| 'protocol';

export interface UsageRecord {
	id: string;
	timestamp: number;
	latencyMs: number;
	status: UsageStatus;
	cursorFacingModelId: string;
	upstreamModelId: string | null;
	requestShape: 'responses' | 'chat_completions' | 'unsupported';
	localAccountKey: string | null;
	inputTokens?: number;
	cachedInputTokens?: number;
	outputTokens?: number;
	reasoningTokens?: number;
	totalTokens?: number;
	finishReason?: string | null;
	outputStarted: boolean;
	errorCategory: SafeErrorCategory;
	errorCode?: string;
}

export interface UsageRecordsResponse {
	records: UsageRecord[];
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

export * from './api-runtime.js';
export * from './public-url.js';
export * from './doctor.js';
export * from './status-bar.js';
export * from './dashboard-bridge.js';
export * from './tunnel.js';
export * from './setup-state.js';
