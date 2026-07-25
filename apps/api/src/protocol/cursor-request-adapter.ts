import type { SafeErrorCategory } from '@codex-auth-ext/shared';

import { resolveModelRoute, type ModelRoutingSettings, type ResolvedModelRoute } from '../models/codex-model-policy.js';

const CODEX_RESPONSES_UNSUPPORTED_PARAMS = new Set([
	'frequency_penalty',
	'max_tokens',
	'presence_penalty',
	'temperature',
	'top_logprobs',
	'top_p'
]);

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
	settings: ModelRoutingSettings,
	headers: Record<string, string | string[] | undefined> = {}
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

	const upstreamRequest =
		requestShape === 'chat_completions'
			? chatCompletionsToResponses(body)
			: responsesPassthrough(body);
	const sessionIdentity = readSessionIdentity(body, headers);

	upstreamRequest.model = route.upstreamModelId;
	upstreamRequest.stream = true;
	upstreamRequest.parallel_tool_calls = true;
	upstreamRequest.store = false;
	if (sessionIdentity && typeof upstreamRequest.prompt_cache_key !== 'string') {
		upstreamRequest.prompt_cache_key = sessionIdentity;
	}

	return {
		ok: true,
		route,
		requestShape,
		upstreamRequest
	};
}

function responsesPassthrough(payload: Record<string, unknown>): Record<string, unknown> {
	const out = { ...payload };

	delete out.stream_options;
	delete out.metadata;
	delete out.user;
	delete out.prompt_cache_retention;
	if (
		!isRecord(out.text) &&
		(out.verbosity === 'low' || out.verbosity === 'medium' || out.verbosity === 'high')
	) {
		out.text = { verbosity: out.verbosity };
	}
	delete out.verbosity;


	for (const key of CODEX_RESPONSES_UNSUPPORTED_PARAMS) {
		delete out[key];
	}

	if (!out.instructions) {
		out.instructions = defaultInstructions();
	}

	if (typeof out.input === 'string') {
		out.input = [
			{
				role: 'user',
				content: [{ type: 'input_text', text: out.input }]
			}
		];
		return out;
	}

	if (Array.isArray(out.input)) {
		const { instructions, input } = normalizeResponsesInput(out.input);

		if (instructions.length > 0) {
			out.instructions =
				out.instructions === defaultInstructions()
					? instructions.join('\n\n')
					: [out.instructions, ...instructions].join('\n\n');
		}

		out.input = input;
	}

	return out;
}

function readSessionIdentity(
	payload: Record<string, unknown>,
	headers: Record<string, string | string[] | undefined>
): string | null {
	if (isRecord(payload.metadata)) {
		for (const key of ['cursorConversationId', 'conversation_id', 'thread_id', 'session_id']) {
			const value = payload.metadata[key];
			if (typeof value === 'string' && value) {
				return value;
			}
		}
	}

	for (const key of [
		'x-cursor-conversation-id',
		'x-client-request-id',
		'thread-id',
		'thread_id',
		'session-id',
		'session_id'
	]) {
		const value = headerValue(headers, key);
		if (value) {
			return value;
		}
	}

	return typeof payload.user === 'string' && payload.user ? payload.user : null;
}

function headerValue(headers: Record<string, string | string[] | undefined>, key: string): string | null {
	for (const [actual, value] of Object.entries(headers)) {
		if (actual.toLowerCase() !== key.toLowerCase()) {
			continue;
		}

		if (Array.isArray(value)) {
			return value.find((item) => item) ?? null;
		}

		return value || null;
	}

	return null;
}

function chatCompletionsToResponses(payload: Record<string, unknown>): Record<string, unknown> {
	const messages = Array.isArray(payload.messages) ? payload.messages : [];
	const instructions: string[] = [];
	const input: Array<Record<string, unknown>> = [];

	for (const message of messages) {
		if (!isRecord(message)) {
			continue;
		}

		const role = message.role;
		const content = message.content;

		if (role === 'system' || role === 'developer') {
			const text = contentToText(content);
			if (text) {
				instructions.push(text);
			}
			continue;
		}

		if (role === 'tool') {
			input.push({
				type: 'function_call_output',
				call_id: message.tool_call_id,
				output: contentToText(content),
				status: 'completed'
			});
			continue;
		}

		if ((role === 'user' || role === 'assistant') && content !== undefined) {
			input.push({
				role,
				content: normalizeContentParts(content, role)
			});
		}

		const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
		for (const toolCall of toolCalls) {
			if (!isRecord(toolCall)) {
				continue;
			}
			const fn = isRecord(toolCall.function) ? toolCall.function : {};
			input.push({
				type: 'function_call',
				call_id: toolCall.id,
				name: fn.name,
				arguments: fn.arguments ?? ''
			});
		}
	}

	const out: Record<string, unknown> = {
		model: payload.model,
		instructions: instructions.length > 0 ? instructions.join('\n\n') : defaultInstructions(),
		input,
		tools: transformTools(payload.tools),
		tool_choice: transformToolChoice(payload.tool_choice)
	};

	if (isRecord(payload.reasoning)) {
		out.reasoning = payload.reasoning;
	}
	if (isRecord(payload.text)) {
		out.text = payload.text;
	} else if (
		payload.verbosity === 'low' ||
		payload.verbosity === 'medium' ||
		payload.verbosity === 'high'
	) {
		out.text = { verbosity: payload.verbosity };
	}
	if (
		typeof payload.max_output_tokens === 'number' &&
		Number.isFinite(payload.max_output_tokens) &&
		payload.max_output_tokens > 0
	) {
		out.max_output_tokens = payload.max_output_tokens;
	}
	if (Array.isArray(payload.include)) {
		out.include = payload.include;
	}
	if (payload.service_tier !== undefined && payload.service_tier !== null) {
		out.service_tier = payload.service_tier;
	}

	return out;
}

function normalizeResponsesInput(items: unknown[]): {
	instructions: string[];
	input: Array<Record<string, unknown>>;
} {
	const instructions: string[] = [];
	const input: Array<Record<string, unknown>> = [];

	for (const item of items) {
		if (!isRecord(item)) {
			continue;
		}

		const role = item.role;

		if (role === 'system' || role === 'developer') {
			const text = contentToText(item.content);
			if (text) {
				instructions.push(text);
			}
			continue;
		}

		if (role === 'user' || role === 'assistant') {
			input.push({
				...item,
				content: normalizeContentParts(item.content, role)
			});
			continue;
		}

		input.push({ ...item });
	}

	return { instructions, input };
}

function normalizeContentParts(content: unknown, role: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(content)) {
		return content.filter(isRecord).map((part) => normalizeContentPart(part, role));
	}

	return [
		{
			type: role === 'assistant' ? 'output_text' : 'input_text',
			text: contentToText(content)
		}
	];
}

function normalizeContentPart(part: Record<string, unknown>, role: unknown): Record<string, unknown> {
	const type = part.type;

	if (type === 'input_text' || type === 'output_text') {
		return { ...part };
	}

	if (type === 'text') {
		return {
			type: role === 'assistant' ? 'output_text' : 'input_text',
			text: String(part.text ?? '')
		};
	}

	if (type === 'image_url' && role === 'user') {
		const image = part.image_url;
		if (typeof image === 'string' && image) {
			return {
				type: 'input_image',
				image_url: image
			};
		}
		if (isRecord(image) && typeof image.url === 'string' && image.url) {
			return {
				type: 'input_image',
				image_url: image.url,
				...(image.detail === 'low' || image.detail === 'high' || image.detail === 'auto'
					? { detail: image.detail }
					: {})
			};
		}
	}

	return { ...part };
}

function contentToText(content: unknown): string {
	if (content === null || content === undefined) {
		return '';
	}

	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (!isRecord(part)) {
					return String(part);
				}
				if (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') {
					return String(part.text ?? '');
				}
				if (part.type === 'image_url') {
					return '[image]';
				}
				return `[${String(part.type ?? 'unknown')}]`;
			})
			.filter(Boolean)
			.join('\n');
	}

	return String(content);
}

function transformTools(tools: unknown): Array<Record<string, unknown>> {
	if (!Array.isArray(tools)) {
		return [];
	}

	const out: Array<Record<string, unknown>> = [];

	for (const tool of tools) {
		if (!isRecord(tool)) {
			continue;
		}

		if (isRecord(tool.function)) {
			out.push({
				type: 'function',
				name: tool.function.name,
				description: tool.function.description,
				parameters: tool.function.parameters,
				strict: false
			});
			continue;
		}

		if (tool.name) {
			out.push({ ...tool });
		}
	}

	return out;
}

function transformToolChoice(toolChoice: unknown): unknown {
	if (!isRecord(toolChoice) || toolChoice.type !== 'function' || !isRecord(toolChoice.function)) {
		return toolChoice;
	}

	return toolChoice.function.name
		? {
				type: 'function',
				name: toolChoice.function.name
			}
		: toolChoice;
}

function defaultInstructions(): string {
	return "You are a coding assistant running through Cursor. Follow the user's request directly.";
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
