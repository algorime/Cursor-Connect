import { SECRET_FIELD_NAMES, type SafeLogEvent } from '@codex-auth-ext/shared';

const SECRET_PATTERN = new RegExp(
	`("(?:${SECRET_FIELD_NAMES.join('|')})"\\s*:\\s*")([^"]+)(")|((?:${SECRET_FIELD_NAMES.join('|')})=)([^\\s,&"]+)`,
	'gi'
);

export interface SafeLoggerSink {
	write(line: string): void;
}

export class SafeRuntimeLogger {
	private readonly events: SafeLogEvent[] = [];
	private readonly sink: SafeLoggerSink;

	constructor(sink: SafeLoggerSink = { write: (line) => process.stdout.write(`${line}\n`) }) {
		this.sink = sink;
	}

	log(event: SafeLogEvent): SafeLogEvent {
		const sanitized = this.sanitizeEvent(event);
		this.events.push(sanitized);
		this.sink.write(JSON.stringify(this.toPayload(sanitized)));

		return sanitized;
	}

	getEvents(): SafeLogEvent[] {
		return this.events.map((event) => structuredClone(event));
	}

	clear(): void {
		this.events.length = 0;
	}

	containsSecretMaterial(value: string): boolean {
		for (const field of SECRET_FIELD_NAMES) {
			if (value.includes(field)) {
				return false;
			}
		}

		return SECRET_PATTERN.test(value);
	}

	private sanitizeEvent(event: SafeLogEvent): SafeLogEvent {
		return {
			...event,
			message: redactSecrets(event.message)
		};
	}

	private toPayload(event: SafeLogEvent): Record<string, unknown> {
		const payload: Record<string, unknown> = {
			component: event.component,
			eventType: event.eventType,
			severity: event.severity,
			timestamp: event.timestamp,
			message: event.message
		};

		if (event.category) {
			payload.category = event.category;
		}

		if (event.port !== undefined) {
			payload.port = event.port;
		}

		if (event.exitCode !== undefined) {
			payload.exitCode = event.exitCode;
		}

		for (const secretField of SECRET_FIELD_NAMES) {
			delete payload[secretField];
		}

		return payload;
	}
}

export function redactSecrets(value: string): string {
	return value.replace(SECRET_PATTERN, (_match, jsonPrefix, _jsonSecret, jsonSuffix, kvPrefix) => {
		if (jsonPrefix) {
			return `${jsonPrefix}[REDACTED]${jsonSuffix}`;
		}

		return `${kvPrefix}[REDACTED]`;
	});
}

export function assertNoSecretsInLogLine(line: string, secrets: string[]): void {
	for (const secret of secrets) {
		if (secret && line.includes(secret)) {
			throw new Error('log line leaked secret material');
		}
	}
}
