import fs from 'node:fs/promises';
import path from 'node:path';

import type { PortRuntimeState } from '@codex-auth-ext/shared';

export class JsonFilePortStore {
	constructor(private readonly filePath: string) {}

	async read(): Promise<PortRuntimeState | null> {
		try {
			const raw = await fs.readFile(this.filePath, 'utf8');
			const parsed = JSON.parse(raw) as PortRuntimeState;

			if (!Number.isInteger(parsed.port) || !parsed.host) {
				return null;
			}

			return parsed;
		} catch {
			return null;
		}
	}

	async write(state: PortRuntimeState): Promise<void> {
		await fs.mkdir(path.dirname(this.filePath), { recursive: true });
		await fs.writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
	}
}

export class MemoryPortStore {
	private state: PortRuntimeState | null = null;

	async read(): Promise<PortRuntimeState | null> {
		return this.state ? structuredClone(this.state) : null;
	}

	async write(state: PortRuntimeState): Promise<void> {
		this.state = structuredClone(state);
	}
}
