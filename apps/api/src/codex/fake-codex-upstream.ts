export type FakeCodexScenario =
	| 'success_text'
	| 'success_tool'
	| 'hidden_reasoning'
	| 'response_failed'
	| 'response_incomplete'
	| 'hard_quota'
	| 'transient_rate_limit'
	| 'context_length'
	| 'provider_failure'
	| 'stream_close';

export function fakeCodexEventsForScenario(scenario: FakeCodexScenario): Array<Record<string, unknown>> {
	switch (scenario) {
		case 'success_text':
			return [
				{ type: 'response.output_text.delta', delta: 'Hello from Codex.' },
				completedEvent()
			];
		case 'success_tool':
			return [
				{
					type: 'response.output_item.added',
					item: {
						type: 'function_call',
						id: 'call_fixture',
						name: 'ReadFile',
						arguments: '{}'
					}
				},
				completedEvent()
			];
		case 'hidden_reasoning':
			return [
				{ type: 'response.reasoning_text.delta', delta: 'private fixture reasoning' },
				{ type: 'response.output_text.delta', delta: 'Visible answer.' },
				completedEvent()
			];
		case 'response_failed':
			return [{ type: 'response.failed', error: { code: 'invalid_request' } }];
		case 'response_incomplete':
			return [{ type: 'response.incomplete', incomplete_details: { reason: 'max_output_tokens' } }];
		case 'hard_quota':
			return [{ type: 'response.failed', error: { code: 'insufficient_quota' } }];
		case 'transient_rate_limit':
			return [{ type: 'error', error: { code: 'rate_limit_exceeded' } }];
		case 'context_length':
			return [{ type: 'response.failed', error: { code: 'context_length_exceeded' } }];
		case 'provider_failure':
			return [{ type: 'error', error: { code: 'server_error' } }];
		case 'stream_close':
			return [{ type: 'response.output_text.delta', delta: 'partial' }];
	}
}

function completedEvent(): Record<string, unknown> {
	return {
		type: 'response.completed',
		response: {
			usage: {
				input_tokens: 100,
				output_tokens: 20,
				total_tokens: 120,
				input_tokens_details: {
					cached_tokens: 40
				},
				output_tokens_details: {
					reasoning_tokens: 5
				}
			}
		}
	};
}
