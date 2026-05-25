import { generateSecret, HEALTH_RESPONSE } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('shared helpers', () => {
	it('generates high-entropy secrets', () => {
		const first = generateSecret();
		const second = generateSecret();

		expect(first).not.toEqual(second);
		expect(first.length).toBeGreaterThan(20);
	});

	it('defines minimal health response', () => {
		expect(HEALTH_RESPONSE).toEqual({ status: 'ok' });
	});
});
