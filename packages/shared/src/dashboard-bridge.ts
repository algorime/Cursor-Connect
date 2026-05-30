import type { DoctorReport } from './doctor.js';
import type { PublicUrlState } from './public-url.js';
import type { ModelWorkaroundDecision, NotificationPreference, SetupState } from './setup-state.js';
import type { StatusBarViewModel } from './status-bar.js';
import type { QuickTunnelStatus } from './tunnel.js';

export interface DashboardBridgeEnvelope {
	requestId: string;
}

export type DashboardToExtensionMessage =
	| (DashboardBridgeEnvelope & { type: 'dashboard.getSetupState' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.verifyPublicUrl'; url: string })
	| (DashboardBridgeEnvelope & { type: 'dashboard.signInCodex' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.importCodexAuth' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.recheckAuth' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.runDoctor' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.startQuickTunnel' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.stopQuickTunnel' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.restartQuickTunnel' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.rotateLocalApiKey' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.setOpenAiKeyRepairDecision'; decision: 'enabled' | 'skipped' | 'decide_later' | 'disabled' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.setStatusBarPreference'; preference: 'visible' | 'hidden' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.setNotificationPreference'; preference: NotificationPreference })
	| (DashboardBridgeEnvelope & { type: 'dashboard.setModelWorkaroundDecision'; decision: ModelWorkaroundDecision })
	| (DashboardBridgeEnvelope & { type: 'dashboard.openCursorSettings'; query: string })
	| (DashboardBridgeEnvelope & { type: 'dashboard.copyCursorSetup'; copyKind: 'full' | 'base_url' | 'api_key' | 'models' })
	| (DashboardBridgeEnvelope & { type: 'dashboard.markManualConfirmation'; confirmed: boolean });

export type ExtensionToDashboardMessage =
	| (DashboardBridgeEnvelope & { type: 'extension.setupState'; state: SetupState })
	| (DashboardBridgeEnvelope & { type: 'extension.doctorReport'; report: DoctorReport })
	| (DashboardBridgeEnvelope & { type: 'extension.publicUrlVerified'; state: PublicUrlState; cursorBaseUrl: string | null })
	| (DashboardBridgeEnvelope & { type: 'extension.quickTunnelStatus'; status: QuickTunnelStatus })
	| (DashboardBridgeEnvelope & { type: 'extension.statusBar'; status: StatusBarViewModel })
	| (DashboardBridgeEnvelope & { type: 'extension.actionComplete'; message: string })
	| (DashboardBridgeEnvelope & { type: 'extension.error'; message: string });
