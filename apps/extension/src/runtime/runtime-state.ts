import {
	createInitialRuntimeSnapshot,
	type RuntimeFailureCategory,
	type RuntimePhase,
	type RuntimeSnapshot
} from '@codex-auth-ext/shared';

export class RuntimeStateModel {
	private snapshot: RuntimeSnapshot = createInitialRuntimeSnapshot();

	getSnapshot(): RuntimeSnapshot {
		return structuredClone(this.snapshot);
	}

	setPhase(phase: RuntimePhase, details?: {
		failureCategory?: RuntimeFailureCategory;
		localTargetUrl?: string | null;
		port?: number | null;
		message?: string | null;
	}): RuntimeSnapshot {
		this.snapshot = {
			phase,
			failureCategory: details?.failureCategory ?? this.inferFailureCategory(phase),
			localTargetUrl: details?.localTargetUrl ?? this.snapshot.localTargetUrl,
			port: details?.port ?? this.snapshot.port,
			message: details?.message ?? null,
			updatedAt: Date.now()
		};

		return this.getSnapshot();
	}

	private inferFailureCategory(phase: RuntimePhase): RuntimeFailureCategory {
		switch (phase) {
			case 'launch_failed':
				return 'launch';
			case 'port_unavailable':
				return 'port';
			case 'health_failed':
				return 'health';
			case 'readiness_failed':
				return 'readiness';
			case 'internal_control_failed':
				return 'internal_control';
			default:
				return 'none';
		}
	}
}
