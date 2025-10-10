/** Fixture loading for ASCII snapshot tests */

export interface MarkdownFixture {
	name: string;
	snapshot: string;
}

/** Parse markdown to extract test fixtures (## Test: name → ```ascii blocks) */
export function* parseMarkdownFixtures(markdownContent: string): IterableIterator<MarkdownFixture> {
	const lines = markdownContent.split('\n');

	let i = 0;
	while (i < lines.length) {
		// Find "## Test: " header
		const line = lines[i];
		if (line.startsWith('## Test: ')) {
			const name = line.substring(9).trim();

			// Find the ```ascii code fence
			let asciiStart = -1;
			let asciiEnd = -1;

			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].trim() === '```ascii') {
					asciiStart = j + 1;
				} else if (asciiStart !== -1 && lines[j].trim() === '```') {
					asciiEnd = j;
					break;
				}
			}

			if (asciiStart !== -1 && asciiEnd !== -1) {
				// Extract snapshot (everything inside code fence)
				const snapshot = lines.slice(asciiStart, asciiEnd).join('\n');
				yield { name, snapshot };

				// Move past this section
				i = asciiEnd + 1;
			} else {
				i++;
			}
		} else {
			i++;
		}
	}
}

export type FixtureLoader = (name: string) => Promise<string>;

/** Create lazy fixture loader from markdown file */
export function createFixtureLoader(fixturesPath: string | URL): FixtureLoader {
	let fixtureMap: Map<string, string> | null = null;
	return async (name: string): Promise<string> => {
		if (!fixtureMap) {
			fixtureMap = new Map();
			const content = await Deno.readTextFile(fixturesPath);
			for (const fixture of parseMarkdownFixtures(content)) {
				fixtureMap.set(fixture.name, fixture.snapshot);
			}
		}
		const fixture = fixtureMap.get(name);
		if (!fixture) {
			throw new Error(`Fixture not found: ${name}\nAvailable: ${[...fixtureMap.keys()].join(', ')}`);
		}
		return fixture;
	};
}
