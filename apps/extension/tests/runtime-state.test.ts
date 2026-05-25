import { describe, expect, it } from 'vitest';

import { RuntimeStateModel } from '../src/runtime/runtime-state.js';

describe('RuntimeStateModel', () => {
	it('tracks successful startup transitions', () => {
		const model = new RuntimeStateModel();

		expect(model.getSnapshot().phase).toBe('not_started');

		model.setPhase('starting');
		model.setPhase('running_health_only', {
			port: 50001,
			localTargetUrl: 'http://127.0.0.1:50001'
		});
		const ready = model.setPhase('ready', {
			port: 50001,
			localTargetUrl: 'http://127.0.0.1:50001'
		});

		expect(ready.phase).toBe('ready');
		expect(ready.failureCategory).toBe('none');
	});

	it('distinguishes port conflict from readiness failure', () => {
		const model = new RuntimeStateModel();

		const portFailure = model.setPhase('port_unavailable', {
			message: 'repair required',
			port: 50001,
			localTargetUrl: 'http://127.0.0.1:50001'
		});
		const readinessFailure = model.setPhase('readiness_failed', {
			message: 'ready check failed',
			port: 50001,
			localTargetUrl: 'http://127.0.0.1:50001'
		});

		expect(portFailure.failureCategory).toBe('port');
		expect(readinessFailure.failureCategory).toBe('readiness');
	});

	it('distinguishes internal control failure from local api key failure category', () => {
		const model = new RuntimeStateModel();

		const controlFailure = model.setPhase('internal_control_failed', {
			message: 'control channel failed'
		});

		expect(controlFailure.failureCategory).toBe('internal_control');
		expect(controlFailure.message).not.toMatch(/secret|token|key/i);
	});
});
