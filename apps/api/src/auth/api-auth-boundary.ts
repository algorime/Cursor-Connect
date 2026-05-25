import {
	AUTH_FAILURE_BODY,
	INTERNAL_CONTROL_HEADER,
	LOCAL_API_KEY_HEADER,
	type SafeLogEvent
} from '@codex-auth-ext/shared';

import { emitSafeLog } from '../logger/safe-logger.js';

export interface LocalApiKeyAuthOptions {
	localApiKey: string;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

export function extractBearerToken(headerValue: string | undefined): string | null {
	if (!headerValue) {
		return null;
	}

	const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());

	return match?.[1] ?? null;
}

export function authenticateLocalApiKey(
	headers: Record<string, string | string[] | undefined>,
	options: LocalApiKeyAuthOptions
): { ok: true } | { ok: false; statusCode: 401 | 403; body: typeof AUTH_FAILURE_BODY } {
	const rawHeader = headers[LOCAL_API_KEY_HEADER];
	const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
	const token = extractBearerToken(headerValue ?? undefined);

	if (!token) {
		emitAuthFailure('missing', options);

		return { ok: false, statusCode: 401, body: AUTH_FAILURE_BODY };
	}

	if (token !== options.localApiKey) {
		emitAuthFailure('invalid', options);

		return { ok: false, statusCode: 403, body: AUTH_FAILURE_BODY };
	}

	return { ok: true };
}

export interface InternalControlAuthOptions {
	internalControlSecret: string;
	onAuthFailure?: (event: SafeLogEvent) => void;
}

export function authenticateInternalControl(
	headers: Record<string, string | string[] | undefined>,
	options: InternalControlAuthOptions
): { ok: true } | { ok: false; statusCode: 401 | 403; body: typeof AUTH_FAILURE_BODY } {
	const rawHeader = headers[INTERNAL_CONTROL_HEADER];
	const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

	if (!headerValue) {
		emitInternalAuthFailure('missing', options);

		return { ok: false, statusCode: 401, body: AUTH_FAILURE_BODY };
	}

	if (headerValue !== options.internalControlSecret) {
		emitInternalAuthFailure('invalid', options);

		return { ok: false, statusCode: 403, body: AUTH_FAILURE_BODY };
	}

	return { ok: true };
}

function emitAuthFailure(reason: 'missing' | 'invalid', options: LocalApiKeyAuthOptions): void {
	const event: SafeLogEvent = {
		component: 'api',
		eventType: 'auth.failure',
		severity: 'warn',
		timestamp: Date.now(),
		category: 'auth',
		message: reason === 'missing' ? 'cursor-facing auth missing' : 'cursor-facing auth rejected'
	};

	options.onAuthFailure?.(event);
	emitSafeLog(event);
}

function emitInternalAuthFailure(
	reason: 'missing' | 'invalid',
	options: InternalControlAuthOptions
): void {
	const event: SafeLogEvent = {
		component: 'api',
		eventType: 'auth.failure',
		severity: 'warn',
		timestamp: Date.now(),
		category: 'auth',
		message: reason === 'missing' ? 'internal control auth missing' : 'internal control auth rejected'
	};

	options.onAuthFailure?.(event);
	emitSafeLog(event);
}

export function rejectIfLocalApiKeyUsedOnInternalRoute(
	headers: Record<string, string | string[] | undefined>,
	localApiKey: string,
	onAuthFailure?: (event: SafeLogEvent) => void
): { ok: true } | { ok: false; statusCode: 403; body: typeof AUTH_FAILURE_BODY } {
	const rawHeader = headers[LOCAL_API_KEY_HEADER];
	const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
	const token = extractBearerToken(headerValue ?? undefined);

	if (token && token === localApiKey) {
		const event: SafeLogEvent = {
			component: 'api',
			eventType: 'auth.failure',
			severity: 'warn',
			timestamp: Date.now(),
			category: 'auth',
			message: 'cursor-facing credential rejected on internal route'
		};

		onAuthFailure?.(event);
		emitSafeLog(event);

		return { ok: false, statusCode: 403, body: AUTH_FAILURE_BODY };
	}

	return { ok: true };
}

export function rejectIfInternalSecretUsedOnCursorRoute(
	headers: Record<string, string | string[] | undefined>,
	internalControlSecret: string,
	onAuthFailure?: (event: SafeLogEvent) => void
): { ok: true } | { ok: false; statusCode: 403; body: typeof AUTH_FAILURE_BODY } {
	const rawHeader = headers[INTERNAL_CONTROL_HEADER];
	const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

	if (headerValue && headerValue === internalControlSecret) {
		const event: SafeLogEvent = {
			component: 'api',
			eventType: 'auth.failure',
			severity: 'warn',
			timestamp: Date.now(),
			category: 'auth',
			message: 'internal control credential rejected on cursor-facing route'
		};

		onAuthFailure?.(event);
		emitSafeLog(event);

		return { ok: false, statusCode: 403, body: AUTH_FAILURE_BODY };
	}

	return { ok: true };
}
