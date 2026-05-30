import { describe, expect, it } from 'vitest';

import {
	COPY_SUCCESS_RETENTION_MS,
	DEFAULT_SUCCESS_RETENTION_MS,
	INITIAL_LOADING_RECOVERY_MS,
	INITIAL_LOADING_STILL_WAITING_MS,
	OPERATION_STILL_WORKING_MS,
	OPERATION_STUCK_MS,
	applyInteractionTimers,
	completeInteraction,
	createDashboardInteractionState,
	currentSetupOperation,
	disabledReasonFor,
	failInteraction,
	globalActivity,
	initialLoadingActivity,
	isActionDisabled,
	isActionPending,
	isSetupLocked,
	startInteraction
} from '../src/interaction-state.js';

describe('dashboard interaction state', () => {
	it('classifies setup operations as locks and disables conflicting setup actions', () => {
		const state = startInteraction(createDashboardInteractionState(1_000), 'start_quick_tunnel', 'quick-1', 1_000);

		expect(isSetupLocked(state)).toBe(true);
		expect(currentSetupOperation(state)?.requestId).toBe('quick-1');
		expect(isActionPending(state, 'start_quick_tunnel')).toBe(true);
		expect(isActionDisabled(state, 'verify_public_url')).toBe(true);
		expect(disabledReasonFor(state, 'verify_public_url')).toBe('Finish the current setup operation first.');
	});

	it('disables read-sensitive copy during setup mutation but copy itself does not lock setup', () => {
		const setupPending = startInteraction(createDashboardInteractionState(0), 'verify_public_url', 'verify-1', 0);
		expect(isActionDisabled(setupPending, 'copy_full_setup')).toBe(true);
		expect(disabledReasonFor(setupPending, 'copy_full_setup')).toBe('Wait for setup to finish before copying values.');

		const copyPending = startInteraction(createDashboardInteractionState(0), 'copy_api_key', 'copy-1', 0);
		expect(isSetupLocked(copyPending)).toBe(false);
		expect(isActionDisabled(copyPending, 'verify_public_url')).toBe(false);
		expect(isActionDisabled(copyPending, 'copy_api_key')).toBe(true);
	});

	it('resolves completion and errors only for matching request ids', () => {
		let state = createDashboardInteractionState(0);
		state = startInteraction(state, 'verify_public_url', 'verify-1', 0);
		state = startInteraction(state, 'run_doctor', 'doctor-2', 10);

		state = completeInteraction(state, 'verify-1', 'Verified public URL.', 20);
		expect(isActionPending(state, 'verify_public_url')).toBe(false);
		expect(isActionPending(state, 'run_doctor')).toBe(true);

		state = failInteraction(state, 'unknown-request', 'Should not attach.', 30);
		expect(globalActivity(state, 30)).toMatchObject({ kind: 'pending', requestId: 'doctor-2' });

		state = failInteraction(state, 'doctor-2', 'Doctor failed.', 40);
		expect(globalActivity(state, 40)).toMatchObject({ kind: 'error', requestId: 'doctor-2', message: 'Doctor failed.' });
	});

	it('escalates pending operations from immediate to slow to stuck recovery guidance', () => {
		const state = startInteraction(createDashboardInteractionState(0), 'restart_quick_tunnel', 'quick-1', 0);

		expect(globalActivity(state, OPERATION_STILL_WORKING_MS - 1)).toMatchObject({ kind: 'pending', stage: 'pending' });
		expect(globalActivity(state, OPERATION_STILL_WORKING_MS)).toMatchObject({ kind: 'pending', stage: 'still-working' });
		expect(globalActivity(state, OPERATION_STUCK_MS)).toMatchObject({
			kind: 'pending',
			stage: 'stuck',
			recovery: expect.stringContaining('run doctor')
		});
	});

	it('prioritizes setup-affecting pending work in global activity when read-only work started first', () => {
		let state = createDashboardInteractionState(0);
		state = startInteraction(state, 'run_doctor', 'doctor-1', 0);
		state = startInteraction(state, 'start_quick_tunnel', 'quick-2', 10);

		expect(globalActivity(state, 20)).toMatchObject({
			kind: 'pending',
			requestId: 'quick-2',
			action: 'start_quick_tunnel'
		});
	});

	it('keeps new setup-affecting pending work visible over an older failed read-only action', () => {
		let state = createDashboardInteractionState(0);
		state = startInteraction(state, 'run_doctor', 'doctor-1', 0);
		state = startInteraction(state, 'start_quick_tunnel', 'quick-2', 10);
		state = failInteraction(state, 'doctor-1', 'Doctor failed.', 20);

		expect(globalActivity(state, 30)).toMatchObject({
			kind: 'pending',
			requestId: 'quick-2',
			action: 'start_quick_tunnel'
		});
	});

	it('retains successes briefly and errors until replaced', () => {
		let state = startInteraction(createDashboardInteractionState(0), 'copy_models', 'copy-1', 0);
		state = completeInteraction(state, 'copy-1', 'Copied model guidance.', 10);
		expect(globalActivity(state, 10)).toMatchObject({ kind: 'success' });
		expect(applyInteractionTimers(state, 10 + COPY_SUCCESS_RETENTION_MS + 1).interactions).toHaveLength(0);

		state = startInteraction(createDashboardInteractionState(0), 'run_doctor', 'doctor-1', 0);
		state = completeInteraction(state, 'doctor-1', 'Doctor report refreshed.', 10);
		expect(applyInteractionTimers(state, 10 + DEFAULT_SUCCESS_RETENTION_MS).interactions).toHaveLength(1);
		expect(applyInteractionTimers(state, 10 + DEFAULT_SUCCESS_RETENTION_MS + 1).interactions).toHaveLength(0);

		state = startInteraction(createDashboardInteractionState(0), 'run_doctor', 'doctor-2', 0);
		state = failInteraction(state, 'doctor-2', 'Doctor failed.', 10);
		expect(applyInteractionTimers(state, 10 + DEFAULT_SUCCESS_RETENTION_MS + 100_000).interactions).toHaveLength(1);
	});

	it('escalates initial loading from spinner to waiting to recovery guidance', () => {
		expect(initialLoadingActivity(1_000, 1_000)).toMatchObject({ stage: 'loading' });
		expect(initialLoadingActivity(1_000, 1_000 + INITIAL_LOADING_STILL_WAITING_MS)).toMatchObject({ stage: 'still-waiting' });
		expect(initialLoadingActivity(1_000, 1_000 + INITIAL_LOADING_RECOVERY_MS)).toMatchObject({
			stage: 'recovery',
			recovery: expect.stringContaining('Reload')
		});
	});
});
