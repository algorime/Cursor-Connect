import type { UsageRecord } from '@codex-auth-ext/shared';
import { SECRET_FIELD_NAMES } from '@codex-auth-ext/shared';

export interface UsageStore {
	record(record: UsageRecord): void;
	list(): UsageRecord[];
}

export class InMemoryUsageStore implements UsageStore {
	private readonly records: UsageRecord[] = [];

	record(record: UsageRecord): void {
		assertSafeUsageRecord(record);
		this.records.push(structuredClone(record));
	}

	list(): UsageRecord[] {
		return this.records.map((record) => structuredClone(record));
	}
}

export function assertSafeUsageRecord(record: UsageRecord): void {
	const serialized = JSON.stringify(record);
	const bannedFragments = [
		'prompt',
		'tool_schema',
		'provider_payload',
		'authorization',
		'accessToken',
		'refreshToken',
		'idToken',
		'localApiKey',
		'internalControlSecret',
		'email'
	];

	for (const secretField of SECRET_FIELD_NAMES) {
		if (serialized.includes(secretField)) {
			throw new Error('usage record contains secret field name');
		}
	}

	for (const fragment of bannedFragments) {
		if (serialized.toLowerCase().includes(fragment.toLowerCase())) {
			throw new Error('usage record contains unsafe fragment');
		}
	}
}
