import type { ChatCompletionChunk, SafeErrorCategory, TokenUsage } from '@codex-auth-ext/shared';

export interface StreamSupervisorResult {
	chunks: ChatCompletionChunk[];
	done: boolean;
	outputStarted: boolean;
	usage: TokenUsage | null;
	finishReason: string | null;
	error: {
		category: SafeErrorCategory;
		code: string;
		message: string;
	} | null;
}

interface SupervisorOptions {
	id?: string;
	model: string;
	created?: number;
	reasoningDisplay?: 'none';
}

export function superviseResponsesEvents(
	events: Array<Record<string, unknown>>,
	options: SupervisorOptions
): StreamSupervisorResult {
	const chunks: ChatCompletionChunk[] = [];
	const id = options.id ?? 'chatcmpl-fixture';
	const created = options.created ?? Math.floor(Date.now() / 1000);
	let outputStarted = false;
	let usage: TokenUsage | null = null;
	let finishReason: string | null = null;
	let error: StreamSupervisorResult['error'] = null;
	let done = false;

	for (const event of events) {
		const type = String(event.type ?? '');

		if (type === 'response.output_text.delta') {
			const delta = typeof event.delta === 'string' ? event.delta : '';
			if (delta) {
				outputStarted = true;
				chunks.push(makeChunk(id, created, options.model, { content: delta }, null));
			}
			continue;
		}

		if (type === 'response.output_item.added' && isToolCall(event.item)) {
			outputStarted = true;
			chunks.push(makeChunk(id, created, options.model, { tool_calls: [event.item] }, null));
			continue;
		}

		if (type === 'response.reasoning_text.delta') {
			// Default reasoning display is none; do not inject reasoning into assistant-visible content.
			continue;
		}

		if (type === 'response.completed') {
			usage = normalizeUsage(event.response);
			finishReason = 'stop';
			chunks.push(makeChunk(id, created, options.model, {}, finishReason, usage));
			done = true;
			break;
		}

		if (type === 'response.failed') {
			error = {
				category: classifyErrorCode(readErrorCode(event)),
				code: readErrorCode(event),
				message: 'upstream response failed'
			};
			break;
		}

		if (type === 'response.incomplete') {
			error = {
				category: 'stream',
				code: 'response_incomplete',
				message: 'upstream response incomplete'
			};
			break;
		}

		if (type === 'error') {
			const code = readErrorCode(event);
			error = {
				category: classifyErrorCode(code),
				code,
				message: 'upstream stream error'
			};
			break;
		}
	}

	if (!done && !error) {
		error = {
			category: 'stream',
			code: 'stream_closed_before_completion',
			message: 'upstream stream closed before completion'
		};
	}

	return {
		chunks,
		done,
		outputStarted,
		usage,
		finishReason,
		error
	};
}

function makeChunk(
	id: string,
	created: number,
	model: string,
	delta: Record<string, unknown>,
	finishReason: string | null,
	usage?: TokenUsage | null
): ChatCompletionChunk {
	return {
		id,
		object: 'chat.completion.chunk',
		created,
		model,
		choices: [
			{
				index: 0,
				delta,
				finish_reason: finishReason
			}
		],
		usage
	};
}

function normalizeUsage(response: unknown): TokenUsage | null {
	if (!isRecord(response) || !isRecord(response.usage)) {
		return null;
	}

	const usage = response.usage;
	const inputTokens = numberField(usage.input_tokens);
	const outputTokens = numberField(usage.output_tokens);
	const totalTokens = numberField(usage.total_tokens) ?? inputTokens + outputTokens;
	const cachedTokens = isRecord(usage.input_tokens_details)
		? numberField(usage.input_tokens_details.cached_tokens)
		: undefined;
	const reasoningTokens = isRecord(usage.output_tokens_details)
		? numberField(usage.output_tokens_details.reasoning_tokens)
		: undefined;

	return {
		prompt_tokens: inputTokens,
		completion_tokens: outputTokens,
		total_tokens: totalTokens,
		prompt_tokens_details: cachedTokens === undefined ? undefined : { cached_tokens: cachedTokens },
		completion_tokens_details:
			reasoningTokens === undefined ? undefined : { reasoning_tokens: reasoningTokens }
	};
}

function readErrorCode(event: Record<string, unknown>): string {
	const error = isRecord(event.error) ? event.error : event;
	return typeof error.code === 'string' ? error.code : 'unknown_error';
}

function classifyErrorCode(code: string): SafeErrorCategory {
	if (code === 'insufficient_quota') {
		return 'quota';
	}
	if (code === 'rate_limit_exceeded') {
		return 'rate_limit';
	}
	if (code === 'context_length_exceeded') {
		return 'context_length';
	}
	if (code === 'invalid_request') {
		return 'invalid_request';
	}
	if (code === 'unauthorized' || code === 'invalid_auth') {
		return 'auth';
	}
	return 'provider';
}

function isToolCall(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && value.type === 'function_call';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberField(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
