export function encodeSseData(value: unknown): string {
	return `data: ${JSON.stringify(value)}\n\n`;
}

export function encodeDone(): string {
	return 'data: [DONE]\n\n';
}

export function parseSseEvents(input: string): Array<Record<string, unknown>> {
	const events: Array<Record<string, unknown>> = [];
	let eventName: string | null = null;
	let dataLines: string[] = [];

	const flush = (): void => {
		if (dataLines.length === 0) {
			eventName = null;
			return;
		}

		const data = dataLines.join('\n');
		dataLines = [];
		const currentEventName = eventName;
		eventName = null;

		if (data === '[DONE]') {
			return;
		}

		const parsed = JSON.parse(data) as unknown;
		if (isRecord(parsed)) {
			events.push(currentEventName && typeof parsed.type !== 'string'
				? { type: currentEventName, ...parsed }
				: parsed);
		}
	};

	for (const rawLine of input.split(/\r?\n/)) {
		if (!rawLine) {
			flush();
			continue;
		}

		if (rawLine.startsWith('event:')) {
			eventName = rawLine.slice('event:'.length).trim();
			continue;
		}

		if (rawLine.startsWith('data:')) {
			dataLines.push(rawLine.slice('data:'.length).trim());
		}
	}

	flush();

	return events;
}

export async function* parseSseEventStream(
	stream: ReadableStream<Uint8Array> | null
): AsyncIterable<Record<string, unknown>> {
	if (!stream) {
		return;
	}

	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let eventName: string | null = null;
	let dataLines: string[] = [];

	const flush = (): Record<string, unknown> | null => {
		if (dataLines.length === 0) {
			eventName = null;
			return null;
		}

		const data = dataLines.join('\n');
		dataLines = [];
		const currentEventName = eventName;
		eventName = null;

		if (data === '[DONE]') {
			return null;
		}

		const parsed = JSON.parse(data) as unknown;
		if (!isRecord(parsed)) {
			return null;
		}

		return currentEventName && typeof parsed.type !== 'string'
			? { type: currentEventName, ...parsed }
			: parsed;
	};

	const processLine = (rawLine: string): Record<string, unknown> | null => {
		const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

		if (!line) {
			return flush();
		}

		if (line.startsWith('event:')) {
			eventName = line.slice('event:'.length).trim();
			return null;
		}

		if (line.startsWith('data:')) {
			dataLines.push(line.slice('data:'.length).trim());
		}

		return null;
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		let newlineIndex = buffer.indexOf('\n');
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);
			const event = processLine(line);
			if (event) {
				yield event;
			}
			newlineIndex = buffer.indexOf('\n');
		}
	}

	buffer += decoder.decode();
	if (buffer) {
		const event = processLine(buffer);
		if (event) {
			yield event;
		}
	}

	const trailing = flush();
	if (trailing) {
		yield trailing;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
