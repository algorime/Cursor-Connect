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

export class ResponsesStreamSupervisor {
	private readonly chunks: ChatCompletionChunk[] = [];
	private readonly id: string;
	private readonly created: number;
	private outputStartedValue = false;
	private usageValue: TokenUsage | null = null;
	private finishReasonValue: string | null = null;
	private errorValue: StreamSupervisorResult['error'] = null;
	private doneValue = false;
	private toolCalls = 0;

	constructor(private readonly options: SupervisorOptions) {
		this.id = options.id ?? 'chatcmpl-fixture';
		this.created = options.created ?? Math.floor(Date.now() / 1000);
	}

	handleEvent(event: Record<string, unknown>): ChatCompletionChunk[] {
		if (this.doneValue) {
			return [];
		}

		const chunkStart = this.chunks.length;
		const type = String(event.type ?? '');

		if (
			type === 'response.output_text.delta' ||
			type === 'response.refusal.delta' ||
			type === 'response.audio.transcript.delta' ||
			type === 'response.code_interpreter_call_code.delta'
		) {
			const delta = typeof event.delta === 'string' ? event.delta : '';
			if (delta) {
				this.outputStartedValue = true;
				this.chunks.push(makeChunk(this.id, this.created, this.options.model, { role: 'assistant', content: delta }, null));
			}
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.output_item.added') {
			if (isToolCall(event.item)) {
				this.outputStartedValue = true;
				const item = event.item;
				const index = this.toolCalls;
				this.toolCalls += 1;
				this.chunks.push(
					makeChunk(
						this.id,
						this.created,
						this.options.model,
						{
							role: 'assistant',
							content: null,
							tool_calls: [
								{
									index,
									id: stringField(item.call_id) || stringField(item.id),
									type: 'function',
									function: {
										name: stringField(item.name),
										arguments: stringField(item.arguments) || stringField(item.input)
									}
								}
							]
						},
						null
					)
				);
			}
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.function_call_arguments.delta' || type === 'response.custom_tool_call_input.delta' || type === 'response.mcp_call_arguments.delta') {
			if (this.toolCalls > 0) {
				this.chunks.push(
					makeChunk(
						this.id,
						this.created,
						this.options.model,
						{
							tool_calls: [
								{
									index: this.toolCalls - 1,
									function: {
										arguments: stringField(event.delta)
									}
								}
							]
						},
						null
					)
				);
			}
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.reasoning_text.delta' || type === 'response.reasoning_summary_text.delta') {
			const delta = stringField(event.delta);
			if (delta) {
				this.chunks.push(makeChunk(this.id, this.created, this.options.model, reasoningDelta(delta), null));
			}
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.completed') {
			this.usageValue = normalizeUsage(event.response);
			this.finishReasonValue = this.toolCalls > 0 ? 'tool_calls' : 'stop';
			this.chunks.push(makeChunk(this.id, this.created, this.options.model, {}, this.finishReasonValue));
			if (this.usageValue) {
				this.chunks.push(makeUsageChunk(this.id, this.created, this.options.model, this.usageValue));
			}
			this.doneValue = true;
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.failed') {
			const code = readErrorCode(event);
			this.errorValue = {
				category: classifyErrorCode(code),
				code,
				message: 'upstream response failed'
			};
			this.doneValue = true;
			return this.chunks.slice(chunkStart);
		}

		if (type === 'response.incomplete') {
			this.errorValue = {
				category: 'stream',
				code: 'response_incomplete',
				message: 'upstream response incomplete'
			};
			this.doneValue = true;
			return this.chunks.slice(chunkStart);
		}

		if (type === 'error') {
			const code = readErrorCode(event);
			this.errorValue = {
				category: classifyErrorCode(code),
				code,
				message: 'upstream stream error'
			};
			this.doneValue = true;
			return this.chunks.slice(chunkStart);
		}

		return this.chunks.slice(chunkStart);
	}

	finish(): ChatCompletionChunk[] {
		const chunkStart = this.chunks.length;

		if (!this.doneValue && !this.errorValue && this.chunks.length > 0) {
			this.errorValue = {
				category: 'stream',
				code: 'stream_closed_before_completion',
				message: 'upstream stream closed before completion'
			};
			this.doneValue = true;
		}

		if (!this.doneValue && !this.errorValue) {
			this.errorValue = {
				category: 'stream',
				code: 'stream_closed_before_completion',
				message: 'upstream stream closed before completion'
			};
			this.doneValue = true;
		}

		return this.chunks.slice(chunkStart);
	}

	snapshot(): StreamSupervisorResult {
		return {
			chunks: [...this.chunks],
			done: this.doneValue,
			outputStarted: this.outputStartedValue,
			usage: this.usageValue,
			finishReason: this.finishReasonValue,
			error: this.errorValue
		};
	}

	get isDone(): boolean {
		return this.doneValue;
	}
}

export function superviseResponsesEvents(
	events: Array<Record<string, unknown>>,
	options: SupervisorOptions
): StreamSupervisorResult {
	const supervisor = new ResponsesStreamSupervisor(options);

	for (const event of events) {
		supervisor.handleEvent(event);
		if (supervisor.isDone) {
			break;
		}
	}

	supervisor.finish();
	return supervisor.snapshot();
}

function reasoningDelta(text: string): Record<string, unknown> {
	const thinkingBlock = { type: 'thinking', thinking: text };

	return {
		role: 'assistant',
		content: null,
		reasoning: text,
		reasoning_content: text,
		reasoning_details: [{ type: 'reasoning.text', text }],
		thinking_blocks: [thinkingBlock],
		provider_specific_fields: {
			thinking_blocks: [thinkingBlock]
		}
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

function makeUsageChunk(
	id: string,
	created: number,
	model: string,
	usage: TokenUsage
): ChatCompletionChunk {
	return {
		id,
		object: 'chat.completion.chunk',
		created,
		model,
		choices: [],
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
		: 0;
	const reasoningTokens = isRecord(usage.output_tokens_details)
		? numberField(usage.output_tokens_details.reasoning_tokens)
		: 0;

	return {
		prompt_tokens: inputTokens,
		completion_tokens: outputTokens,
		total_tokens: totalTokens,
		prompt_tokens_details: { cached_tokens: cachedTokens },
		completion_tokens_details: { reasoning_tokens: reasoningTokens }
	};
}

function readErrorCode(event: Record<string, unknown>): string {
	const response = isRecord(event.response) ? event.response : null;
	const error = isRecord(response?.error) ? response.error : isRecord(event.error) ? event.error : event;
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
	return isRecord(value) && (value.type === 'function_call' || value.type === 'custom_tool_call');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numberField(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringField(value: unknown): string {
	return typeof value === 'string' ? value : '';
}
