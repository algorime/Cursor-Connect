const DOCTOR_SECRET_FIELD_NAMES = [
	'localApiKey',
	'internalControlSecret',
	'authorization',
	'x-internal-control-secret',
	'token',
	'accessToken',
	'refreshToken',
	'oauthToken'
] as const;

export type DoctorCheckStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
	id: string;
	label: string;
	status: DoctorCheckStatus;
	guidance: string;
	details?: Record<string, unknown>;
}

export interface DoctorReport {
	generatedAt: number;
	checks: DoctorCheck[];
	groups: Record<DoctorCheckStatus, DoctorCheck[]>;
}

const REDACTED = '[REDACTED]';

export function redactDoctorReport(report: DoctorReport): DoctorReport {
	return {
		generatedAt: report.generatedAt,
		checks: report.checks.map((check) => ({
			...check,
			details: check.details ? redactDetails(check.details) : undefined
		})),
		groups: {
			pass: report.groups.pass.map(redactCheck),
			warn: report.groups.warn.map(redactCheck),
			fail: report.groups.fail.map(redactCheck)
		}
	};
}

export function groupDoctorChecks(checks: DoctorCheck[]): Record<DoctorCheckStatus, DoctorCheck[]> {
	return {
		pass: checks.filter((check) => check.status === 'pass'),
		warn: checks.filter((check) => check.status === 'warn'),
		fail: checks.filter((check) => check.status === 'fail')
	};
}

function redactCheck(check: DoctorCheck): DoctorCheck {
	return {
		...check,
		details: check.details ? redactDetails(check.details) : undefined
	};
}

function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
	const redacted: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(details)) {
		if (DOCTOR_SECRET_FIELD_NAMES.some((secretKey) => key.toLowerCase().includes(secretKey.toLowerCase()))) {
			redacted[key] = REDACTED;
			continue;
		}

		redacted[key] = redactValue(value);
	}

	return redacted;
}

function redactValue(value: unknown): unknown {
	if (typeof value === 'string') {
		return looksSecretLike(value) ? REDACTED : value;
	}

	if (Array.isArray(value)) {
		return value.map(redactValue);
	}

	if (value && typeof value === 'object') {
		return redactDetails(value as Record<string, unknown>);
	}

	return value;
}

function looksSecretLike(value: string): boolean {
	return /Bearer\s+\S+|sk-[A-Za-z0-9_-]+|refresh[_-]?token|access[_-]?token/i.test(value);
}
