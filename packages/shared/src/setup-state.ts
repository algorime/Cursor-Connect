import type { ApiTrafficStatus } from './api-runtime.js';
import type { PublicUrlState } from './public-url.js';
import type { QuickTunnelStatus } from './tunnel.js';

export type SetupChecklistStatus = 'complete' | 'active' | 'blocked' | 'pending' | 'warning';

export interface SetupChecklistItem {
	id: string;
	label: string;
	status: SetupChecklistStatus;
	guidance: string;
}

export type NotificationPreference = 'important_only' | 'balanced' | 'verbose';
export type ModelWorkaroundDecision = 'enabled' | 'skipped' | 'decide_later';
export type OpenAiKeyRepairDecision = 'enabled' | 'skipped' | 'decide_later' | 'disabled';
export interface OpenAiKeyRepairStatus {
	decision: OpenAiKeyRepairDecision;
	capability: 'available' | 'unavailable';
	reason?: string;
}
export type SetupReadinessState = 'blocked' | 'setup' | 'ready';

export interface SetupReadiness {
	state: SetupReadinessState;
	blockers: string[];
	warnings: string[];
}

export interface CursorSetupReadiness {
	manualConfirmed: boolean;
	confirmedAt?: number | null;
	staleReason?: string | null;
}

export interface SetupState {
	generatedAt: number;
	environmentLabel: string;
	statusBarPreference: 'visible' | 'hidden';
	notificationPreference: NotificationPreference;
	modelWorkaroundDecision: ModelWorkaroundDecision;
	openAiKeyRepair?: OpenAiKeyRepairStatus;
	localTargetUrl: string | null;
	publicUrl: PublicUrlState;
	apiTraffic: ApiTrafficStatus;
	cursorSetup?: CursorSetupReadiness;
	tunnel: QuickTunnelStatus;
	readiness: SetupReadiness;
	items: SetupChecklistItem[];
}
