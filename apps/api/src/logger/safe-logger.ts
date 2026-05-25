import { SECRET_FIELD_NAMES, type SafeLogEvent } from '@codex-auth-ext/shared';

const SECRET_PATTERN = new RegExp(
	`("(?:${SECRET_FIELD_NAMES.join('|')})"\\s*:\\s*")([^"]+)(")|((?:${SECRET_FIELD_NAMES.join('|')})=)([^\\s,&"]+)`,
	'gi'
);

export function redactSecrets(value: string): string {
	return value.replace(SECRET_PATTERN, (_match, jsonPrefix, _jsonSecret, jsonSuffix, kvPrefix) => {
		if (jsonPrefix) {
			return `${jsonPrefix}[REDACTED]${jsonSuffix}`;
		}

		return `${kvPrefix}[REDACTED]`;
	});
}

export function sanitizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(fields)) {
		if (SECRET_FIELD_NAMES.some((secretKey) => key.toLowerCase().includes(secretKey.toLowerCase()))) {
			continue;
		}

		if (typeof value === 'string') {
			sanitized[key] = redactSecrets(value);
			continue;
		}

		sanitized[key] = value;
	}

	return sanitized;
}

export function emitSafeLog(event: SafeLogEvent): void {
	const payload = sanitizeLogFields({
		component: event.component,
		eventType: event.eventType,
		severity: event.severity,
		timestamp: event.timestamp,
		category: event.category,
		message: redactSecrets(event.message),
		port: event.port,
		exitCode: event.exitCode,
		method: event.method,
		path: event.path,
		hasAuthHeader: event.hasAuthHeader,
		userAgent: event.userAgent,
		requestId: event.requestId,
		statusCode: event.statusCode,
		errorCategory: event.errorCategory,
		errorCode: event.errorCode,
		upstreamStatus: event.upstreamStatus,
		refreshedAfter401: event.refreshedAfter401
	});

	process.stdout.write(`${JSON.stringify(payload)}\n`);
}
