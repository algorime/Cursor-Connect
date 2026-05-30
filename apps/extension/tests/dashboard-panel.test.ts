import type { DashboardToExtensionMessage } from '@codex-auth-ext/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attachDashboardBridge } from '../src/dashboard/dashboard-panel.js';
import {
	SETUP_COPY_BUSY_MESSAGE,
	SETUP_MUTATION_BUSY_MESSAGE,
	SetupMutationGuard,
	assertSetupCopyAllowed,
	runGuardedSetupMutation
} from '../src/dashboard/setup-mutation-guard.js';
import type { SetupCoordinator } from '../src/setup/setup-coordinator.js';

vi.mock('vscode', () => ({
	commands: {
		executeCommand: vi.fn(async () => undefined)
	}
}));

interface BridgeHarness {
	posted: unknown[];
	send(message: DashboardToExtensionMessage): void;
}

function createBridgeHarness(coordinator: Partial<SetupCoordinator>, guard: SetupMutationGuard = new SetupMutationGuard(), clipboard = { writeText: vi.fn(async () => undefined) }): BridgeHarness {
	let listener: ((message: DashboardToExtensionMessage) => void) | null = null;
	const posted: unknown[] = [];
	const webview = {
		onDidReceiveMessage: (handler: (message: DashboardToExtensionMessage) => void) => {
			listener = handler;
			return { dispose: vi.fn() };
		},
		postMessage: vi.fn(async (message: unknown) => {
			posted.push(message);
			return true;
		})
	};
	attachDashboardBridge({ webview } as never, coordinator as SetupCoordinator, clipboard, undefined, guard);
	return {
		posted,
		send(message: DashboardToExtensionMessage) {
			if (!listener) {
				throw new Error('bridge listener was not attached');
			}
			listener(message);
		}
	};
}

function deferred<T = void>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((innerResolve, innerReject) => {
		resolve = innerResolve;
		reject = innerReject;
	});
	return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

const setupState = { environmentLabel: 'test' } as never;

describe('dashboard setup mutation guard', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('rejects a second setup mutation from the same webview while one is pending', async () => {
		const gate = deferred();
		const coordinator = {
			verifyPublicUrl: vi.fn(async () => gate.promise),
			markManualConfirmation: vi.fn(async () => undefined),
			getSetupState: vi.fn(async () => setupState)
		};
		const bridge = createBridgeHarness(coordinator);

		bridge.send({ type: 'dashboard.verifyPublicUrl', requestId: 'verify-1', url: 'https://codex.example.com' });
		await flushPromises();
		bridge.send({ type: 'dashboard.markManualConfirmation', requestId: 'confirm-2', confirmed: true });
		await flushPromises();

		expect(coordinator.markManualConfirmation).not.toHaveBeenCalled();
		expect(bridge.posted).toContainEqual({
			type: 'extension.error',
			requestId: 'confirm-2',
			message: SETUP_MUTATION_BUSY_MESSAGE
		});

		gate.resolve(undefined);
		await flushPromises();
		await vi.waitFor(() => {
			expect(bridge.posted.some((message) =>
				(message as { type?: string; requestId?: string }).type === 'extension.setupState'
				&& (message as { requestId?: string }).requestId === 'verify-1'
			)).toBe(true);
		});
	});

	it('rejects a setup mutation from a separate webview sharing the activation guard', async () => {
		const gate = deferred();
		const guard = new SetupMutationGuard();
		const firstCoordinator = {
			verifyPublicUrl: vi.fn(async () => gate.promise),
			getSetupState: vi.fn(async () => setupState)
		};
		const secondCoordinator = {
			startQuickTunnel: vi.fn(async () => setupState.tunnel)
		};
		const first = createBridgeHarness(firstCoordinator, guard);
		const second = createBridgeHarness(secondCoordinator, guard);

		first.send({ type: 'dashboard.verifyPublicUrl', requestId: 'verify-1', url: 'https://codex.example.com' });
		await flushPromises();
		second.send({ type: 'dashboard.startQuickTunnel', requestId: 'model-2' });
		await flushPromises();

		expect(secondCoordinator.startQuickTunnel).not.toHaveBeenCalled();
		expect(second.posted).toContainEqual({
			type: 'extension.error',
			requestId: 'model-2',
			message: SETUP_MUTATION_BUSY_MESSAGE
		});
	});

	it('rejects setup-copy from the same or another webview while a setup mutation is pending', async () => {
		const gate = deferred();
		const guard = new SetupMutationGuard();
		const clipboard = { writeText: vi.fn(async () => undefined) };
		const coordinator = {
			verifyPublicUrl: vi.fn(async () => gate.promise),
			copyCursorSetupValue: vi.fn(async () => 'stale setup'),
			getSetupState: vi.fn(async () => setupState)
		};
		const first = createBridgeHarness(coordinator, guard, clipboard);
		const second = createBridgeHarness(coordinator, guard, clipboard);

		first.send({ type: 'dashboard.verifyPublicUrl', requestId: 'verify-1', url: 'https://codex.example.com' });
		await flushPromises();
		first.send({ type: 'dashboard.copyCursorSetup', requestId: 'copy-same', copyKind: 'full' });
		second.send({ type: 'dashboard.copyCursorSetup', requestId: 'copy-other', copyKind: 'base_url' });
		await flushPromises();

		expect(coordinator.copyCursorSetupValue).not.toHaveBeenCalled();
		expect(clipboard.writeText).not.toHaveBeenCalled();
		expect(first.posted).toContainEqual({
			type: 'extension.error',
			requestId: 'copy-same',
			message: SETUP_COPY_BUSY_MESSAGE
		});
		expect(second.posted).toContainEqual({
			type: 'extension.error',
			requestId: 'copy-other',
			message: SETUP_COPY_BUSY_MESSAGE
		});
	});

	it('allows read-only setup refresh while a setup mutation is pending', async () => {
		const gate = deferred();
		const coordinator = {
			verifyPublicUrl: vi.fn(async () => gate.promise),
			getSetupState: vi.fn(async () => setupState)
		};
		const bridge = createBridgeHarness(coordinator);

		bridge.send({ type: 'dashboard.verifyPublicUrl', requestId: 'verify-1', url: 'https://codex.example.com' });
		await flushPromises();
		bridge.send({ type: 'dashboard.getSetupState', requestId: 'refresh-2' });
		await flushPromises();

		expect(coordinator.getSetupState).toHaveBeenCalledTimes(1);
		expect(bridge.posted).toContainEqual({
			type: 'extension.setupState',
			requestId: 'refresh-2',
			state: setupState
		});
	});

	it('refreshes setup state after saving the OpenAI-key repair decision so dashboards keep the selected choice', async () => {
		const doctorReport = { checks: [], groups: { pass: [], warn: [], fail: [] } };
		const coordinator = {
			setOpenAiKeyRepairDecision: vi.fn(async () => doctorReport),
			getSetupState: vi.fn(async () => ({
				...setupState,
				openAiKeyRepair: { decision: 'enabled', capability: 'available' }
			}))
		};
		const bridge = createBridgeHarness(coordinator);

		bridge.send({ type: 'dashboard.setOpenAiKeyRepairDecision', requestId: 'repair-1', decision: 'enabled' });
		await flushPromises();

		expect(coordinator.setOpenAiKeyRepairDecision).toHaveBeenCalledWith('enabled');
		expect(bridge.posted).toContainEqual({
			type: 'extension.doctorReport',
			requestId: 'repair-1',
			report: doctorReport
		});
		expect(bridge.posted).toContainEqual({
			type: 'extension.setupState',
			requestId: 'repair-1',
			state: expect.objectContaining({
				openAiKeyRepair: { decision: 'enabled', capability: 'available' }
			})
		});
	});

	it('clears the guard after setup mutation success and failure', async () => {
		const coordinator = {
			verifyPublicUrl: vi.fn(async (url: string) => {
				if (url.includes('broken')) {
					throw new Error('verification failed');
				}
			}),
			markManualConfirmation: vi.fn(async () => undefined),
			getSetupState: vi.fn(async () => setupState)
		};
		const bridge = createBridgeHarness(coordinator);

		bridge.send({ type: 'dashboard.verifyPublicUrl', requestId: 'broken-1', url: 'https://broken.example.com' });
		await flushPromises();
		bridge.send({ type: 'dashboard.markManualConfirmation', requestId: 'confirm-2', confirmed: true });
		await flushPromises();

		expect(bridge.posted).toContainEqual({
			type: 'extension.error',
			requestId: 'broken-1',
			message: 'verification failed'
		});
		expect(coordinator.markManualConfirmation).toHaveBeenCalledWith(true);
		expect(bridge.posted).toContainEqual({
			type: 'extension.setupState',
			requestId: 'confirm-2',
			state: setupState
		});
	});

	it('shares guard semantics with command-style copy and mutation helpers', async () => {
		const guard = new SetupMutationGuard();
		const gate = deferred();
		const running = runGuardedSetupMutation(guard, 'dashboard.verify', async () => gate.promise);
		await flushPromises();

		expect(() => assertSetupCopyAllowed(guard)).toThrow(SETUP_COPY_BUSY_MESSAGE);
		await expect(runGuardedSetupMutation(guard, 'command.restartTunnel', async () => 'not-run')).rejects.toThrow(SETUP_MUTATION_BUSY_MESSAGE);

		gate.resolve(undefined);
		await running;
		expect(() => assertSetupCopyAllowed(guard)).not.toThrow();
		await expect(runGuardedSetupMutation(guard, 'command.restartTunnel', async () => 'ran')).resolves.toBe('ran');
	});

	it('delegates dashboard auth actions to existing extension commands and refreshes setup state', async () => {
		const vscode = await import('vscode');
		const executeCommand = vi.mocked(vscode.commands.executeCommand);
		const coordinator = {
			getSetupState: vi.fn(async () => setupState)
		};
		const afterSetupStateChange = vi.fn(async () => undefined);
		let listener: ((message: DashboardToExtensionMessage) => void) | null = null;
		const posted: unknown[] = [];
		const webview = {
			onDidReceiveMessage: (handler: (message: DashboardToExtensionMessage) => void) => {
				listener = handler;
				return { dispose: vi.fn() };
			},
			postMessage: vi.fn(async (message: unknown) => {
				posted.push(message);
				return true;
			})
		};
		attachDashboardBridge({ webview } as never, coordinator as unknown as SetupCoordinator, undefined, afterSetupStateChange);

		listener?.({ type: 'dashboard.signInCodex', requestId: 'sign-in' });
		await vi.waitFor(() => expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'sign-in', state: setupState })));
		listener?.({ type: 'dashboard.importCodexAuth', requestId: 'import-auth' });
		await vi.waitFor(() => expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'import-auth', state: setupState })));
		listener?.({ type: 'dashboard.recheckAuth', requestId: 'recheck-auth' });
		await vi.waitFor(() => expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'recheck-auth', state: setupState })));

		expect(executeCommand).toHaveBeenCalledWith('codexAuthExt.signInCodex');
		expect(executeCommand).toHaveBeenCalledWith('codexAuthExt.importCodexAuthJson');
		expect(afterSetupStateChange).toHaveBeenCalledTimes(3);
		expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'sign-in', state: setupState }));
		expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'import-auth', state: setupState }));
		expect(posted).toContainEqual(expect.objectContaining({ type: 'extension.setupState', requestId: 'recheck-auth', state: setupState }));
	});

});
