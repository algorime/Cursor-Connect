import type { SafeErrorCategory } from '@codex-auth-ext/shared';

import { resolveModelRoute, type ModelRoutingSettings, type ResolvedModelRoute } from '../models/codex-model-policy.js';

export type CursorRequestAdapterResult =
	| {
			ok: true;
			route: ResolvedModelRoute;
			requestShape: 'responses' | 'chat_completions';
			upstreamRequest: Record<string, unknown>;
	  }
	| {
			ok: false;
			statusCode: number;
			errorCategory: SafeErrorCategory;
			errorCode: string;
			message: string;
	  };

export function adaptCursorRequestToCodexResponses(
	body: unknown,
	settings: ModelRoutingSettings
): CursorRequestAdapterResult {
	if (!isRecord(body)) {
		return adapterError('invalid_request', 'invalid_json', 'request body must be a JSON object');
	}

	const model = typeof body.model === 'string' ? body.model : '';
	const route = resolveModelRoute(model, settings);

	if (!route) {
		return adapterError('invalid_request', 'unsupported_model', 'unsupported Cursor-Facing Model ID');
	}

	const requestShape = Array.isArray(body.input)
		? 'responses'
		: Array.isArray(body.messages)
			? 'chat_completions'
			: null;

	if (!requestShape) {
		return adapterError('protocol', 'unsupported_request_shape', 'unsupported Cursor request shape');
	}

	if (requestShape === 'chat_completions' && model !== 'gpt-5.4') {
		return adapterError('protocol', 'diagnostic_shape_only', 'chat completions shape is diagnostic-only');
	}

	const upstreamRequest: Record<string, unknown> = {
		...body,
		model: route.upstreamModelId,
		stream: body.stream !== false
	};

	if (requestShape === 'chat_completions') {
		upstreamRequest.input = body.messages;
		delete upstreamRequest.messages;
	}

	return {
		ok: true,
		route,
		requestShape,
		upstreamRequest
	};
}

function adapterError(
	errorCategory: SafeErrorCategory,
	errorCode: string,
	message: string
): CursorRequestAdapterResult {
	return {
		ok: false,
		statusCode: 400,
		errorCategory,
		errorCode,
		message
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
