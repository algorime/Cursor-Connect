import { LOCAL_API_KEY_HEADER, type SafeLogEvent } from '@codex-auth-ext/shared';
import type { FastifyRequest } from 'fastify';

import { emitSafeLog } from './safe-logger.js';

const CURSOR_FACING_PATHS = new Set(['/v1/models', '/v1/chat/completions']);
const MAX_HEADER_VALUE_LENGTH = 160;

export function emitCursorFacingRequestLog(request: FastifyRequest): void {
	const path = readPathname(request.url);

	if (!CURSOR_FACING_PATHS.has(path)) {
		return;
	}

	const event: SafeLogEvent = {
		component: 'api',
		eventType: 'api.request',
		severity: 'info',
		timestamp: Date.now(),
		message: 'cursor-facing request received',
		method: request.method,
		path,
		hasAuthHeader: Boolean(readFirstHeader(request.headers[LOCAL_API_KEY_HEADER])),
		userAgent: truncateHeaderValue(readFirstHeader(request.headers['user-agent'])),
		requestId: truncateHeaderValue(
			readFirstHeader(request.headers['x-request-id']) ??
				readFirstHeader(request.headers['x-client-request-id'])
		)
	};

	emitSafeLog(event);
}

function readPathname(url: string): string {
	try {
		return new URL(url, 'http://127.0.0.1').pathname;
	} catch {
		return url.split('?')[0] ?? url;
	}
}

function readFirstHeader(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) {
		return value[0] ?? null;
	}

	return value ?? null;
}

function truncateHeaderValue(value: string | null): string | null {
	if (!value) {
		return null;
	}

	return value.slice(0, MAX_HEADER_VALUE_LENGTH);
}
