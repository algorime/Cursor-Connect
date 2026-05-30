import {
	groupDoctorChecks,
	redactDoctorReport,
	type ApiTrafficStatus,
	type CodexAuthState,
	type DoctorCheck,
	type DoctorReport,
	type ModelWorkaroundDecision,
	type PublicUrlState,
	type QuickTunnelStatus,
	type NotificationPreference,
	type RuntimeSnapshot,
	type StatusBarPreference,
	type CursorSetupReadiness
} from '@codex-auth-ext/shared';

import type { ProvisionResult } from './cloudflared-provisioner.js';

export interface DoctorReportInput {
	runtime: RuntimeSnapshot;
	publicUrl: PublicUrlState;
	codexAuthState: CodexAuthState;
	apiTraffic: ApiTrafficStatus;
	tunnel: QuickTunnelStatus;
	openAiKeyRepair: { decision: string; capability: string; reason?: string };
	statusPreference: StatusBarPreference;
	notificationPreference: NotificationPreference;
	cursorSetup?: CursorSetupReadiness;
	modelWorkaround?: ModelWorkaroundDecision;
	localApiKeyPresent?: boolean;
	cloudflaredProvision: ProvisionResult | null;
	usageStorageState: 'ready' | 'degraded';
	environmentLabel: string;
	secrets?: Record<string, unknown>;
	now?: () => number;
}

export function buildDoctorReport(input: DoctorReportInput): DoctorReport {
	const checks: DoctorCheck[] = [
		check('runtime', 'Local API runtime', input.runtime.phase === 'ready' ? 'pass' : 'warn', input.runtime.message ?? `Runtime phase: ${input.runtime.phase}`, {
			localTargetUrl: input.runtime.localTargetUrl,
			bindHost: readRuntimeHost(input.runtime.localTargetUrl),
			runtimeId: input.runtime.runtimeId
		}),
		check('environment', 'Extension host environment', isLoopbackRuntime(input.runtime.localTargetUrl) ? 'pass' : 'warn', environmentGuidance(input), {
			environmentLabel: input.environmentLabel,
			localTargetUrl: input.runtime.localTargetUrl,
			bindHost: readRuntimeHost(input.runtime.localTargetUrl),
			runtimeId: input.runtime.runtimeId
		}),
		check('public-url-health', 'Public URL route health', ['route_health_ok', 'authenticated_ready', 'wrong_key', 'wrong_runtime'].includes(input.publicUrl.state) ? 'pass' : 'warn', guidanceForPublicUrlHealth(input.publicUrl), { ...input.publicUrl }),
		check('public-url-ready', 'Public URL authenticated readiness', input.publicUrl.state === 'authenticated_ready' ? 'pass' : 'warn', guidanceForPublicUrlReady(input.publicUrl), { ...input.publicUrl }),
		check('codex-auth', 'Codex authentication', input.codexAuthState === 'authenticated' ? 'pass' : 'fail', input.codexAuthState === 'authenticated' ? 'Codex auth is ready.' : 'Sign in or repair Codex auth.'),
		check('local-api-key', 'Generated local API key', input.localApiKeyPresent === false ? 'fail' : 'pass', input.localApiKeyPresent === false ? 'Generated local API key is missing; restart or repair the extension runtime.' : 'Generated local API key is present and redacted.'),
		check('cursor-traffic', 'Cursor traffic', input.apiTraffic.lastCursorFacingRequest ? 'pass' : 'warn', input.apiTraffic.lastCursorFacingRequest ? 'Last authenticated Cursor-facing request was detected.' : 'No authenticated Cursor traffic has been detected yet.', input.apiTraffic.lastCursorFacingRequest ? { ...input.apiTraffic.lastCursorFacingRequest } : undefined),
		check('cursor-setup-confirmation', 'Cursor setup confirmation', cursorSetupStatus(input), cursorSetupGuidance(input), input.cursorSetup ? { ...input.cursorSetup } : undefined),
		check('model-compatibility-fallback', 'Model compatibility fallback', 'pass', modelWorkaroundGuidance(input.modelWorkaround), { decision: input.modelWorkaround ?? 'decide_later' }),
		check('quick-tunnel', 'Quick Tunnel', input.tunnel.state === 'running' ? 'warn' : 'pass', input.tunnel.state === 'running' ? 'Quick Tunnel is temporary/testing and streaming remains unsupported or unverified.' : 'Quick Tunnel is not currently the active public route.', { ...input.tunnel }),
		check('cloudflared-provisioning', 'cloudflared provisioning', input.cloudflaredProvision?.status && input.cloudflaredProvision.status !== 'ready' ? 'warn' : 'pass', cloudflaredProvisionGuidance(input.cloudflaredProvision), input.cloudflaredProvision ? { status: input.cloudflaredProvision.status, message: input.cloudflaredProvision.message, asset: input.cloudflaredProvision.asset?.name } : undefined),
		check('openai-key-repair', 'OpenAI-key repair', openAiKeyRepairStatus(input.openAiKeyRepair), openAiKeyRepairGuidance(input.openAiKeyRepair), input.openAiKeyRepair),
		check('status-bar', 'Status bar', input.statusPreference === 'visible' ? 'pass' : 'warn', input.statusPreference === 'visible' ? 'Status bar is visible.' : 'Status bar is hidden by preference.'),
		check('notification-preference', 'Notification preference', 'pass', `Notification preset is ${input.notificationPreference}.`, { notificationPreference: input.notificationPreference }),
		check('usage-storage', 'Usage storage', input.usageStorageState === 'ready' ? 'pass' : 'warn', input.usageStorageState === 'ready' ? 'Usage storage is ready.' : 'Usage storage is degraded; proxying can continue.', input.secrets)
	];

	return redactDoctorReport({ generatedAt: (input.now ?? Date.now)(), checks, groups: groupDoctorChecks(checks) });
}

export function doctorReportToMarkdown(report: DoctorReport): string {
	return [
		`# Codex Setup Doctor (${new Date(report.generatedAt).toISOString()})`,
		...(['fail', 'warn', 'pass'] as const).flatMap((status) => [
			`## ${status.toUpperCase()}`,
			...(report.groups[status].length
				? report.groups[status].map((check) => `- ${check.label}: ${check.guidance}`)
				: ['- None'])
		])
	].join('\n');
}

function check(id: string, label: string, status: DoctorCheck['status'], guidance: string, details?: Record<string, unknown>): DoctorCheck {
	return { id, label, status, guidance, details };
}

function guidanceForPublicUrlHealth(state: PublicUrlState): string {
	if (state.state === 'authenticated_ready' || state.state === 'route_health_ok') return 'Public route reached the extension /health endpoint.';
	if (state.state === 'wrong_runtime') return 'Public route is live but points at a different extension-host runtime.';
	if (state.state === 'wrong_key') return 'Public route is live but rejected the generated local API key.';
	if (state.state === 'timeout') return 'Public route timed out; check forwarding and tunnel state.';
	if (state.state === 'unreachable') return 'Public route did not return minimal /health.';
	return 'Configure and verify a durable HTTPS public Extension Base URL.';
}

function guidanceForPublicUrlReady(state: PublicUrlState): string {
	if (state.state === 'authenticated_ready') return 'Public URL is verified against the current runtime.';
	if (state.state === 'wrong_runtime') return 'Public URL points at a different extension-host runtime.';
	if (state.state === 'wrong_key') return 'Public URL rejected the generated local API key.';
	if (state.state === 'route_health_ok') return 'Public route is live but authenticated /ready is not ready.';
	return 'Authenticated readiness has not been verified yet.';
}

function environmentGuidance(input: DoctorReportInput): string {
	if (isLoopbackRuntime(input.runtime.localTargetUrl)) {
		return `Setup belongs to ${input.environmentLabel}. Public URLs must resolve to this extension-host runtime.`;
	}
	return 'Local API bind host does not look loopback-only; verify the runtime is not exposed directly and rotate the local API key if it was shared.';
}

function readRuntimeHost(localTargetUrl: string | null): string | null {
	if (!localTargetUrl) return null;
	try {
		return new URL(localTargetUrl).hostname;
	} catch {
		return null;
	}
}

function isLoopbackRuntime(localTargetUrl: string | null): boolean {
	const host = readRuntimeHost(localTargetUrl);
	return !host || host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}

function cursorSetupStatus(input: DoctorReportInput): DoctorCheck['status'] {
	if (!input.cursorSetup?.manualConfirmed) {
		return 'warn';
	}
	if (input.cursorSetup.staleReason) {
		return 'warn';
	}
	return input.apiTraffic.lastCursorFacingRequest ? 'pass' : 'warn';
}

function cursorSetupGuidance(input: DoctorReportInput): string {
	if (!input.cursorSetup?.manualConfirmed) {
		return 'Cursor setup has not been manually confirmed in the dashboard.';
	}
	if (input.cursorSetup.staleReason) {
		return input.cursorSetup.staleReason;
	}
	if (!input.apiTraffic.lastCursorFacingRequest) {
		return 'Cursor setup is confirmed, but no authenticated Cursor traffic has been detected yet.';
	}
	return 'Cursor setup is confirmed and authenticated Cursor traffic was observed.';
}

function modelWorkaroundGuidance(decision: ModelWorkaroundDecision | undefined): string {
	if (decision === 'enabled') {
		return 'Advanced fallback is enabled: gpt-5.4 routes upstream to gpt-5.5.';
	}
	if (decision === 'skipped') {
		return 'Advanced fallback is skipped; direct Cursor model routing remains the normal path.';
	}
	return 'Advanced fallback is dormant and does not block Ready Setup while direct gpt-5.5 routing is verified.';
}

function openAiKeyRepairStatus(repair: DoctorReportInput['openAiKeyRepair']): DoctorCheck['status'] {
	if (repair.capability === 'available') {
		return repair.decision === 'decide_later' ? 'warn' : 'pass';
	}
	return repair.decision === 'enabled' ? 'warn' : 'pass';
}

function openAiKeyRepairGuidance(repair: DoctorReportInput['openAiKeyRepair']): string {
	if (repair.capability === 'available') {
		if (repair.decision === 'enabled') return 'Compatibility repair is enabled and available; this is non-blocking for Ready.';
		if (repair.decision === 'disabled') return 'Compatibility repair is explicitly disabled; normal proxying is not blocked.';
		if (repair.decision === 'skipped') return 'Compatibility repair is skipped for now; normal proxying is not blocked.';
		return 'Compatibility repair is available but optional; decide only if Cursor OpenAI-key compatibility needs repair.';
	}
	if (repair.decision === 'enabled') {
		return `Compatibility repair was requested but is unavailable (${repair.reason ?? 'unknown reason'}); normal proxying is not blocked.`;
	}
	return `Compatibility repair is unavailable (${repair.reason ?? 'unknown reason'}); normal proxying is not blocked.`;
}

function cloudflaredProvisionGuidance(result: ProvisionResult | null): string {
	if (!result) return 'cloudflared has not been provisioned in this setup session yet.';
	if (result.status === 'ready') return 'cloudflared binary is verified in the extension cache.';
	return result.message ?? `cloudflared provisioning failed: ${result.status}`;
}
