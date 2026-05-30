import type { DashboardToExtensionMessage } from '@codex-auth-ext/shared';

export const SETUP_MUTATION_BUSY_MESSAGE = 'Finish the current setup operation before starting another.';
export const SETUP_COPY_BUSY_MESSAGE = 'Wait for setup to finish before copying values.';

export class SetupMutationGuard {
	private activeRequestId: string | null = null;

	isActive(): boolean {
		return this.activeRequestId !== null;
	}

	tryBegin(requestId: string): SetupMutationGuardRelease | null {
		if (this.activeRequestId !== null) {
			return null;
		}
		this.activeRequestId = requestId;
		let released = false;
		return {
			release: () => {
				if (!released && this.activeRequestId === requestId) {
					this.activeRequestId = null;
				}
				released = true;
			}
		};
	}
}

export interface SetupMutationGuardRelease {
	release(): void;
}

export async function runGuardedSetupMutation<T>(
	guard: SetupMutationGuard,
	requestId: string,
	run: () => Promise<T>
): Promise<T> {
	const release = guard.tryBegin(requestId);
	if (!release) {
		throw new Error(SETUP_MUTATION_BUSY_MESSAGE);
	}
	try {
		return await run();
	} finally {
		release.release();
	}
}

export function assertSetupCopyAllowed(guard: SetupMutationGuard): void {
	if (guard.isActive()) {
		throw new Error(SETUP_COPY_BUSY_MESSAGE);
	}
}

export function isSetupAffectingDashboardMessage(message: DashboardToExtensionMessage): boolean {
	switch (message.type) {
		case 'dashboard.signInCodex':
		case 'dashboard.importCodexAuth':
		case 'dashboard.verifyPublicUrl':
		case 'dashboard.markManualConfirmation':
		case 'dashboard.rotateLocalApiKey':
		case 'dashboard.setOpenAiKeyRepairDecision':
		case 'dashboard.setStatusBarPreference':
		case 'dashboard.setNotificationPreference':
		case 'dashboard.startQuickTunnel':
		case 'dashboard.stopQuickTunnel':
		case 'dashboard.restartQuickTunnel':
			return true;
		default:
			return false;
	}
}

export function isSetupCopyDashboardMessage(message: DashboardToExtensionMessage): boolean {
	return message.type === 'dashboard.copyCursorSetup';
}
