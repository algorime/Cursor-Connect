import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import initSqlJs from 'sql.js';
import type { UsageRecord } from '@codex-auth-ext/shared';

import { assertSafeUsageRecord, type UsageStore } from './usage-store.js';

type SqlJsDatabase = initSqlJs.Database;

export class SqliteUsageStore implements UsageStore {
	private constructor(
		private readonly dbPath: string,
		private readonly db: SqlJsDatabase
	) {}

	static async open(dbPath: string): Promise<SqliteUsageStore> {
		await fsp.mkdir(path.dirname(dbPath), { recursive: true });
		const SQL = await initSqlJs({
			locateFile: (file) => resolveSqlJsAsset(file)
		});
		const existing = fs.existsSync(dbPath) ? await fsp.readFile(dbPath) : null;
		const db = new SQL.Database(existing);
		const store = new SqliteUsageStore(dbPath, db);
		store.migrate();
		await store.flush();

		return store;
	}

	record(record: UsageRecord): void {
		assertSafeUsageRecord(record);
		this.db.run(
			`INSERT INTO usage_records (
				id,
				timestamp,
				latency_ms,
				status,
				cursor_facing_model_id,
				upstream_model_id,
				request_shape,
				local_account_key,
				input_tokens,
				cached_input_tokens,
				output_tokens,
				reasoning_tokens,
				total_tokens,
				finish_reason,
				output_started,
				error_category,
				error_code
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				record.id,
				record.timestamp,
				record.latencyMs,
				record.status,
				record.cursorFacingModelId,
				record.upstreamModelId,
				record.requestShape,
				record.localAccountKey,
				record.inputTokens ?? null,
				record.cachedInputTokens ?? null,
				record.outputTokens ?? null,
				record.reasoningTokens ?? null,
				record.totalTokens ?? null,
				record.finishReason ?? null,
				record.outputStarted ? 1 : 0,
				record.errorCategory,
				record.errorCode ?? null
			]
		);
		this.flushSync();
	}

	list(): UsageRecord[] {
		const result = this.db.exec(
			`SELECT
				id,
				timestamp,
				latency_ms,
				status,
				cursor_facing_model_id,
				upstream_model_id,
				request_shape,
				local_account_key,
				input_tokens,
				cached_input_tokens,
				output_tokens,
				reasoning_tokens,
				total_tokens,
				finish_reason,
				output_started,
				error_category,
				error_code
			FROM usage_records
			ORDER BY timestamp ASC, rowid ASC`
		);

		const rows = result[0]?.values ?? [];
		return rows.map((row) => usageRecordFromRow(row));
	}

	async close(): Promise<void> {
		this.flushSync();
		this.db.close();
	}

	private migrate(): void {
		this.db.run(`
			CREATE TABLE IF NOT EXISTS usage_records (
				id TEXT PRIMARY KEY,
				timestamp INTEGER NOT NULL,
				latency_ms INTEGER NOT NULL,
				status TEXT NOT NULL,
				cursor_facing_model_id TEXT NOT NULL,
				upstream_model_id TEXT,
				request_shape TEXT NOT NULL,
				local_account_key TEXT,
				input_tokens INTEGER,
				cached_input_tokens INTEGER,
				output_tokens INTEGER,
				reasoning_tokens INTEGER,
				total_tokens INTEGER,
				finish_reason TEXT,
				output_started INTEGER NOT NULL,
				error_category TEXT NOT NULL,
				error_code TEXT
			);
			CREATE INDEX IF NOT EXISTS usage_records_timestamp_idx ON usage_records(timestamp);
			CREATE INDEX IF NOT EXISTS usage_records_local_account_key_idx ON usage_records(local_account_key);
			CREATE INDEX IF NOT EXISTS usage_records_model_idx ON usage_records(cursor_facing_model_id, upstream_model_id);
		`);
	}

	private async flush(): Promise<void> {
		await fsp.writeFile(this.dbPath, this.exportBuffer());
	}

	private flushSync(): void {
		fs.writeFileSync(this.dbPath, this.exportBuffer());
	}

	private exportBuffer(): Buffer {
		return Buffer.from(this.db.export());
	}
}

function resolveSqlJsAsset(file: string): string {
	if (process.env.CODEX_AUTH_EXT_SQL_WASM_PATH) {
		return process.env.CODEX_AUTH_EXT_SQL_WASM_PATH;
	}

	const candidates = [
		path.join(process.cwd(), file),
		path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
		path.join(process.cwd(), 'apps', 'api', 'node_modules', 'sql.js', 'dist', file)
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return file;
}

function usageRecordFromRow(row: initSqlJs.SqlValue[]): UsageRecord {
	return {
		id: stringValue(row[0]),
		timestamp: numberValue(row[1]),
		latencyMs: numberValue(row[2]),
		status: stringValue(row[3]) as UsageRecord['status'],
		cursorFacingModelId: stringValue(row[4]),
		upstreamModelId: nullableStringValue(row[5]),
		requestShape: stringValue(row[6]) as UsageRecord['requestShape'],
		localAccountKey: nullableStringValue(row[7]),
		inputTokens: optionalNumberValue(row[8]),
		cachedInputTokens: optionalNumberValue(row[9]),
		outputTokens: optionalNumberValue(row[10]),
		reasoningTokens: optionalNumberValue(row[11]),
		totalTokens: optionalNumberValue(row[12]),
		finishReason: nullableStringValue(row[13]),
		outputStarted: numberValue(row[14]) === 1,
		errorCategory: stringValue(row[15]) as UsageRecord['errorCategory'],
		errorCode: nullableStringValue(row[16]) ?? undefined
	};
}

function stringValue(value: initSqlJs.SqlValue): string {
	return typeof value === 'string' ? value : String(value);
}

function nullableStringValue(value: initSqlJs.SqlValue): string | null {
	return value === null ? null : stringValue(value);
}

function numberValue(value: initSqlJs.SqlValue): number {
	return typeof value === 'number' ? value : Number(value);
}

function optionalNumberValue(value: initSqlJs.SqlValue): number | undefined {
	return value === null ? undefined : numberValue(value);
}
