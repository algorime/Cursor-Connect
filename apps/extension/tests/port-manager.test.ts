import { LOOPBACK_HOST, type PortRuntimeState } from '@codex-auth-ext/shared';
import { describe, expect, it } from 'vitest';

import { MemoryPortStore } from '../src/runtime/port-store.js';
import { PortManager, type PortAvailabilityChecker } from '../src/runtime/port-manager.js';

class FakePortChecker implements PortAvailabilityChecker {
	constructor(private readonly unavailable: Set<number>) {}

	async isPortAvailable(_host: string, port: number): Promise<boolean> {
		return !this.unavailable.has(port);
	}
}

describe('PortManager', () => {
	it('selects and persists a random high port on first run', async () => {
		const store = new MemoryPortStore();
		const manager = new PortManager({
			store,
			checker: new FakePortChecker(new Set()),
			random: () => 0
		});

		const result = await manager.resolvePort();

		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		expect(result.state.port).toBeGreaterThanOrEqual(49152);
		expect(result.state.host).toBe(LOOPBACK_HOST);

		const persisted = await store.read();

		expect(persisted).toEqual(result.state);
	});

	it('reuses the persisted port on restart', async () => {
		const store = new MemoryPortStore();
		const persisted: PortRuntimeState = { host: LOOPBACK_HOST, port: 54321 };
		await store.write(persisted);

		const manager = new PortManager({
			store,
			checker: new FakePortChecker(new Set())
		});

		const result = await manager.resolvePort();

		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		expect(result.state).toEqual(persisted);
	});

	it('enters repair-required state when persisted port is occupied', async () => {
		const store = new MemoryPortStore();
		const persisted: PortRuntimeState = { host: LOOPBACK_HOST, port: 54321 };
		await store.write(persisted);

		const manager = new PortManager({
			store,
			checker: new FakePortChecker(new Set([54321]))
		});

		const result = await manager.resolvePort();

		expect(result.ok).toBe(false);

		if (result.ok) {
			return;
		}

		expect(result.repairRequired).toBe(true);
		expect(result.reason).toBe('port_unavailable');
		expect(result.state).toEqual(persisted);
	});

	it('exposes the local target url for inspection', async () => {
		const manager = new PortManager({
			store: new MemoryPortStore(),
			checker: new FakePortChecker(new Set()),
			random: () => 0
		});

		const result = await manager.resolvePort();

		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		expect(manager.getLocalTargetUrl(result.state)).toBe(
			`http://${LOOPBACK_HOST}:${result.state.port}`
		);
	});
});
