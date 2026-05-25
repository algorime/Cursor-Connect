export function encodeSseData(value: unknown): string {
	return `data: ${JSON.stringify(value)}\n\n`;
}

export function encodeDone(): string {
	return 'data: [DONE]\n\n';
}

export function parseSseEvents(input: string): Array<Record<string, unknown>> {
	const events: Array<Record<string, unknown>> = [];

	for (const block of input.split(/\n\n+/)) {
		const dataLines = block
			.split('\n')
			.filter((line) => line.startsWith('data:'))
			.map((line) => line.slice('data:'.length).trim());

		if (dataLines.length === 0) {
			continue;
		}

		const data = dataLines.join('\n');
		if (data === '[DONE]') {
			continue;
		}

		const parsed = JSON.parse(data) as unknown;
		if (isRecord(parsed)) {
			events.push(parsed);
		}
	}

	return events;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
