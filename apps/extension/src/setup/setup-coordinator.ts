import {
	createEmptyApiTrafficStatus,
	createQuickTunnelStatus,
	type CodexAuthState,
	type DoctorReport,
	type InternalStatusResponse,
	type ModelWorkaroundDecision,
	type NotificationPreference,
	type OpenAiKeyRepairDecision,
	type QuickTunnelStatus,
	type RuntimeSnapshot,
	type SetupState,
	type StatusBarViewModel
} from '@codex-auth-ext/shared';

import type { CredentialStore } from '../runtime/credentials.js';
import { buildCursorSetupDetails, CURSOR_SETUP_MODELS, serializeCursorSetup } from '../runtime/cursor-setup.js';
import type { ExtensionStateStore } from '../settings/model-routing.js';
import type { ProvisionResult } from './cloudflared-provisioner.js';
import { buildDoctorReport, doctorReportToMarkdown } from './doctor.js';
import type { OpenAiKeyRepairController } from './openai-key-repair.js';
import type { PublicUrlManager } from './public-url-manager.js';
import type { QuickTunnelManager } from './quick-tunnel-manager.js';
import { buildExtensionSetupState, type CursorSetupState } from './setup-state.js';
import { buildExtensionStatusBarViewModel } from './status-bar.js';

const CURSOR_CONFIRMATION_KEY = 'codexAuthExt.setup.cursorManualConfirmation';
const STATUS_BAR_PREFERENCE_KEY = 'codexAuthExt.setup.statusBarPreference';
const NOTIFICATION_PREFERENCE_KEY = 'codexAuthExt.setup.notificationPreference';

export interface SetupCoordinatorOptions {
	state: ExtensionStateStore;
	credentials: CredentialStore;
	publicUrl: PublicUrlManager;
	getRuntimeSnapshot: () => RuntimeSnapshot;
	getCodexAuthState: () => Promise<CodexAuthState>;
	getInternalStatus: () => Promise<InternalStatusResponse | null>;
	getModelWorkaroundEnabled: () => boolean;
	getModelWorkaroundDecision?: () => ModelWorkaroundDecision;
	setModelWorkaroundDecision?: (decision: ModelWorkaroundDecision) => Promise<void>;
	restartRuntime?: () => Promise<RuntimeSnapshot>;
	getTunnelStatus?: () => QuickTunnelStatus;
	quickTunnel?: QuickTunnelManager;
	provisionQuickTunnelBinary?: () => Promise<ProvisionResult>;
	getCloudflaredProvisionResult?: () => ProvisionResult | null;
	openAiKeyRepair?: OpenAiKeyRepairController;
	environmentLabel?: string;
	quickTunnelVerificationAttempts?: number;
	quickTunnelVerificationDelayMs?: number;
}

export class SetupCoordinator {
	constructor(private readonly options: SetupCoordinatorOptions) {}

	async getSetupState(): Promise<SetupState> {
		const internal = await this.options.getInternalStatus();
		const runtime = this.options.getRuntimeSnapshot();
		const openAiKeyRepair = await this.options.openAiKeyRepair?.getStatus();

		return buildExtensionSetupState({
			runtime,
			codexAuthState: await this.options.getCodexAuthState(),
			publicUrl: this.options.publicUrl.getState(),
			apiTraffic: internal?.traffic ?? createEmptyApiTrafficStatus(),
			cursorSetup: this.getCursorSetupState(),
			modelWorkaround: this.getModelWorkaroundDecision(),
			tunnel: this.getTunnelStatus(),
			usageStorageState: internal?.usageStorageState ?? 'ready',
			environmentLabel: this.getEnvironmentLabel(),
			statusBarPreference: this.getStatusBarPreference(),
			notificationPreference: this.getNotificationPreference(),
			openAiKeyRepair
		});
	}

	async verifyPublicUrl(url: string) {
		const state = await this.options.publicUrl.verify(url, { source: 'user_provided' });
		await this.markCursorSetupStale('Extension Base URL was verified or changed; confirm the current Cursor setup again.');
		return state;
	}

	getCursorBaseUrl(): string | null {
		const publicUrl = this.options.publicUrl.getState();
		const tunnel = this.getTunnelStatus();
		if (
			publicUrl.source === 'quick_tunnel'
			&& publicUrl.state === 'authenticated_ready'
			&& (!publicUrl.url || tunnel.state !== 'running' || tunnel.url !== publicUrl.url)
		) {
			return null;
		}
		return this.options.publicUrl.getCursorBaseUrl();
	}

	async buildCursorSetupText(apiKeyRotated = false): Promise<string> {
		const runtime = this.options.getRuntimeSnapshot();
		if (!runtime.localTargetUrl) {
			throw new Error('Runtime target URL is not available');
		}
		const extensionBaseUrl = this.getCursorBaseUrl();
		if (!extensionBaseUrl) {
			throw new Error('Verify a public Extension Base URL before copying final Cursor setup instructions.');
		}

		return serializeCursorSetup(buildCursorSetupDetails({
			localTargetUrl: runtime.localTargetUrl,
			extensionBaseUrl,
			apiKey: await this.options.credentials.getLocalApiKey(),
			routeKind: this.options.publicUrl.getState().source ?? 'none',
			temporaryRoute: this.options.publicUrl.getState().temporary,
			manualConfirmationRequired: true,
			apiKeyRotated
		}));
	}

	async copyCursorSetupValue(copyKind: 'full' | 'base_url' | 'api_key' | 'models'): Promise<string> {
		if (copyKind === 'full') {
			return this.buildCursorSetupText();
		}
		if (copyKind === 'base_url') {
			const cursorBaseUrl = this.getCursorBaseUrl();
			if (!cursorBaseUrl) {
				throw new Error('Verify a public Extension Base URL before copying a Cursor Base URL.');
			}
			return cursorBaseUrl;
		}
		if (copyKind === 'api_key') {
			return this.options.credentials.getLocalApiKey();
		}
		return this.buildModelGuidance();
	}

	async markManualConfirmation(confirmed: boolean): Promise<void> {
		await this.options.state.update(CURSOR_CONFIRMATION_KEY, {
			manualConfirmed: confirmed,
			confirmedAt: confirmed ? Date.now() : null,
			staleReason: confirmed ? null : 'Manual Cursor setup confirmation was cleared.'
		} satisfies CursorSetupState);
	}

	async rotateLocalApiKey(): Promise<string> {
		await this.options.credentials.rotateLocalApiKey();
		if (!this.options.restartRuntime) {
			throw new Error('Runtime restart is required after rotating the local API key.');
		}
		await this.options.restartRuntime();
		await this.markCursorSetupStale('Local API key was rotated; update Cursor settings and confirm setup again.');
		await this.options.publicUrl.markStale('Local API key was rotated; verify the public URL and update Cursor settings.');
		return 'Local API key rotated. Use Copy local API key when you are ready to update Cursor.';
	}

	async runDoctor(): Promise<DoctorReport> {
		const internal = await this.options.getInternalStatus();
		const openAiKeyRepair = await this.options.openAiKeyRepair?.getStatus();
		const localApiKey = await this.options.credentials.getLocalApiKey();

		return buildDoctorReport({
			runtime: this.options.getRuntimeSnapshot(),
			publicUrl: this.options.publicUrl.getState(),
			codexAuthState: await this.options.getCodexAuthState(),
			apiTraffic: internal?.traffic ?? createEmptyApiTrafficStatus(),
			tunnel: this.getTunnelStatus(),
			openAiKeyRepair: openAiKeyRepair ?? { decision: 'decide_later', capability: 'unavailable', reason: 'not_found' },
			statusPreference: this.getStatusBarPreference(),
			notificationPreference: this.getNotificationPreference(),
			cursorSetup: this.getCursorSetupState(),
			modelWorkaround: this.getModelWorkaroundDecision(),
			localApiKeyPresent: localApiKey.length > 0,
			cloudflaredProvision: this.options.getCloudflaredProvisionResult?.() ?? null,
			usageStorageState: internal?.usageStorageState ?? 'ready',
			environmentLabel: this.getEnvironmentLabel()
		});
	}

	async runDoctorMarkdown(): Promise<string> {
		return doctorReportToMarkdown(await this.runDoctor());
	}

	async setOpenAiKeyRepairDecision(decision: OpenAiKeyRepairDecision): Promise<DoctorReport> {
		if (!this.options.openAiKeyRepair) {
			throw new Error('OpenAI-key repair decision surface is not available.');
		}
		await this.options.openAiKeyRepair.setDecision(decision);
		return this.runDoctor();
	}

	async setStatusBarPreference(preference: 'visible' | 'hidden'): Promise<SetupState> {
		await this.options.state.update(STATUS_BAR_PREFERENCE_KEY, preference);
		return this.getSetupState();
	}

	async setNotificationPreference(preference: NotificationPreference): Promise<SetupState> {
		await this.options.state.update(NOTIFICATION_PREFERENCE_KEY, preference);
		return this.getSetupState();
	}

	async setModelWorkaroundDecision(decision: ModelWorkaroundDecision): Promise<SetupState> {
		if (!this.options.setModelWorkaroundDecision) {
			throw new Error('Harness Routing Workaround decision surface is not available.');
		}
		await this.options.setModelWorkaroundDecision(decision);
		if (this.options.restartRuntime) {
			await this.options.restartRuntime();
		}
		await this.markCursorSetupStale('Harness Routing Workaround decision changed; copy the final Cursor setup guidance again.');
		return this.getSetupState();
	}

	async getStatusBarViewModel(): Promise<StatusBarViewModel> {
		const setup = await this.getSetupState();
		const hasBlocked = setup.readiness.state === 'blocked';

		return buildExtensionStatusBarViewModel({
			preference: this.getStatusBarPreference(),
			setupReady: setup.readiness.state === 'ready',
			tunnelRunning: setup.tunnel.state === 'running',
			authReady: setup.items.find((item) => item.id === 'codex-auth')?.status === 'complete',
			routeReady: setup.publicUrl.state === 'authenticated_ready',
			routeStale: setup.publicUrl.state === 'wrong_runtime',
			temporaryRoute: setup.publicUrl.temporary && setup.publicUrl.state === 'authenticated_ready',
			hasError: hasBlocked
		});
	}

	async startQuickTunnel(): Promise<QuickTunnelStatus> {
		const localTargetUrl = this.options.getRuntimeSnapshot().localTargetUrl;
		if (!this.options.quickTunnel || !localTargetUrl) {
			return createQuickTunnelStatus('unsupported', null, 'Quick Tunnel is not available for this runtime.');
		}
		const provision = await this.ensureQuickTunnelBinary();
		if (provision) {
			return provision;
		}
		const status = await this.options.quickTunnel.start({ localTargetUrl });
		return this.verifyQuickTunnelStatus(status);
	}

	async stopQuickTunnel(): Promise<QuickTunnelStatus> {
		if (!this.options.quickTunnel) {
			return createQuickTunnelStatus('unsupported', null, 'Quick Tunnel is not available for this runtime.');
		}
		const previousTunnelUrl = this.getTunnelStatus().url;
		const status = await this.options.quickTunnel.stop();
		const publicUrl = this.options.publicUrl.getState();
		if (
			previousTunnelUrl
			&& publicUrl.source === 'quick_tunnel'
			&& publicUrl.url === previousTunnelUrl
		) {
			await this.options.publicUrl.markStale('Quick Tunnel was stopped; start or restart it before relying on this temporary route.');
			await this.markCursorSetupStale('Quick Tunnel was stopped; Cursor setup must be confirmed again after a new route is verified.');
		}
		return status;
	}

	async restartQuickTunnel(): Promise<QuickTunnelStatus> {
		const localTargetUrl = this.options.getRuntimeSnapshot().localTargetUrl;
		if (!this.options.quickTunnel || !localTargetUrl) {
			return createQuickTunnelStatus('unsupported', null, 'Quick Tunnel is not available for this runtime.');
		}
		const provision = await this.ensureQuickTunnelBinary();
		if (provision) {
			return provision;
		}
		const status = await this.options.quickTunnel.restart({ localTargetUrl });
		return this.verifyQuickTunnelStatus(status);
	}

	private async verifyQuickTunnelStatus(status: QuickTunnelStatus): Promise<QuickTunnelStatus> {
		if (status.state === 'running' && status.url) {
			const verification = await this.verifyQuickTunnelPublicUrl(status.url);
			await this.markCursorSetupStale('Temporary Quick Tunnel URL was verified or changed; confirm the current Cursor setup again.');
			if (verification.state !== 'authenticated_ready') {
				return {
					...status,
					message: verification.message ?? 'Quick Tunnel started, but the public URL is not authenticated-ready yet.'
				};
			}
		}
		return status;
	}

	private async verifyQuickTunnelPublicUrl(url: string) {
		const attempts = this.options.quickTunnelVerificationAttempts ?? 60;
		const delayMs = this.options.quickTunnelVerificationDelayMs ?? 1_000;
		let verification = await this.options.publicUrl.verify(url, { source: 'quick_tunnel' });
		for (let attempt = 1; attempt < attempts && isRetryableQuickTunnelVerification(verification.state); attempt += 1) {
			await delay(delayMs);
			verification = await this.options.publicUrl.verify(url, { source: 'quick_tunnel' });
		}
		return verification;
	}

	private async ensureQuickTunnelBinary(): Promise<QuickTunnelStatus | null> {
		if (!this.options.provisionQuickTunnelBinary) {
			return null;
		}
		const result = await this.options.provisionQuickTunnelBinary();
		if (result.status === 'ready') {
			return null;
		}
		return createQuickTunnelStatus('unsupported', null, cloudflaredProvisionGuidance(result));
	}

	private getCursorSetupState(): CursorSetupState {
		return this.options.state.get<CursorSetupState>(CURSOR_CONFIRMATION_KEY) ?? { manualConfirmed: false };
	}

	private async markCursorSetupStale(staleReason: string): Promise<void> {
		await this.options.state.update(CURSOR_CONFIRMATION_KEY, {
			...this.getCursorSetupState(),
			manualConfirmed: false,
			confirmedAt: null,
			staleReason
		} satisfies CursorSetupState);
	}

	private getTunnelStatus(): QuickTunnelStatus {
		return this.options.getTunnelStatus?.() ?? this.options.quickTunnel?.getStatus() ?? createQuickTunnelStatus('not_started');
	}

	private buildModelGuidance(): string {
		const decision = this.getModelWorkaroundDecision();
		const lines = [
			'Recommended Cursor-facing model: gpt-5.5.',
			'Direct model path: use gpt-5.5 directly so Cursor-selected reasoning effort and summary settings pass through unchanged.',
			decision === 'enabled'
				? 'Advanced Harness Routing Workaround: enabled; the extension routes gpt-5.4 upstream to gpt-5.5 as an explicit fallback.'
				: decision === 'skipped'
					? 'Advanced Harness Routing Workaround: skipped; direct Cursor model routing remains the normal path.'
					: 'Advanced Harness Routing Workaround: dormant; no decision is required for Ready while direct gpt-5.5 routing is verified.',
			'Secondary Cursor-facing model: gpt-5.4-mini.',
			'Do not use custom model IDs as the normal setup path; they can lose Cursor OpenAI-family harness behavior.',
			`Model IDs to add/select: ${CURSOR_SETUP_MODELS.join(', ')}`
		];
		return lines.join('\n');
	}

	private getModelWorkaroundDecision(): ModelWorkaroundDecision {
		return this.options.getModelWorkaroundDecision?.() ?? (this.options.getModelWorkaroundEnabled() ? 'enabled' : 'decide_later');
	}

	private getStatusBarPreference(): 'visible' | 'hidden' {
		return this.options.state.get<'visible' | 'hidden'>(STATUS_BAR_PREFERENCE_KEY) ?? 'visible';
	}

	private getNotificationPreference(): NotificationPreference {
		return this.options.state.get<NotificationPreference>(NOTIFICATION_PREFERENCE_KEY) ?? 'balanced';
	}

	private getEnvironmentLabel(): string {
		return this.options.environmentLabel ?? 'Current extension host';
	}
}

function isRetryableQuickTunnelVerification(state: string): boolean {
	return state === 'unreachable' || state === 'timeout' || state === 'route_health_ok';
}

async function delay(ms: number): Promise<void> {
	if (ms <= 0) {
		return;
	}
	await new Promise((resolve) => setTimeout(resolve, ms));
}

function cloudflaredProvisionGuidance(result: ProvisionResult): string {
	return result.message ?? `cloudflared provisioning failed: ${result.status}`;
}
