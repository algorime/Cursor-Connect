export type RuntimeId = string;

export interface ApiTrafficSignal {
	method: string;
	path: '/v1/models' | '/v1/chat/completions' | string;
	at: number;
}

export interface ApiTrafficStatus {
	lastCursorFacingRequest: ApiTrafficSignal | null;
}

export function createEmptyApiTrafficStatus(): ApiTrafficStatus {
	return {
		lastCursorFacingRequest: null
	};
}

export function recordCursorFacingTraffic(
	status: ApiTrafficStatus,
	signal: ApiTrafficSignal
): ApiTrafficStatus {
	return {
		...status,
		lastCursorFacingRequest: {
			method: signal.method,
			path: signal.path,
			at: signal.at
		}
	};
}

export function generateRuntimeId(byteLength = 16): RuntimeId {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return Buffer.from(bytes).toString('base64url');
}
