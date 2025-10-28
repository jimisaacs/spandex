/**
 * Markdown snapshot parser and writer
 *
 * Parses and serializes snapshot files using structured markdown format:
 *
 * ## Format Structure
 *
 * ```markdown
 * # Title
 *
 * ## Test: Snapshot Name
 *
 * **Purpose**: Optional description
 *
 * ```json
 * { "snapshot": "content" }
 * ```
 *
 * ---
 * ```
 *
 * ## Design Rationale
 *
 * - **`## Test:` headings**: Delimit snapshots, enable multiple per file
 * - **`**Purpose**:` metadata**: Optional human-readable context
 * - **Code blocks vs raw**: Language tag presence controls rendering
 * - **`---` separators**: Visual boundary between snapshots
 *
 * @module
 */

export interface FixtureMetadata {
	/** Test name from "## Test: Name" heading */
	name: string;
	/** Optional description from "**Purpose**: ..." */
	purpose: string | undefined;
	/** Snapshot content (inside code block or raw markdown) */
	content: string;
	/** Position in file for order preservation */
	index: number;
	/** Controls code block wrapping: present = ` ```tag `, undefined = raw markdown */
	languageTag: string | undefined;
}

export interface FixtureFile {
	/** Header text before first "## Test:" section */
	readonly header: string;
	/** All snapshots indexed by name */
	readonly fixtures: Map<string, FixtureMetadata>;
}

/**
 * Parse markdown snapshot file
 *
 * Extracts "## Test: Name" sections with content (code blocks or raw markdown).
 */
export function parseFixtureFile(markdown: string): FixtureFile {
	const fixtures = new Map<string, FixtureMetadata>();

	// Extract header (everything before first "## Test:")
	const firstTestMatch = markdown.match(/^## Test:/m);
	const header = firstTestMatch ? markdown.substring(0, firstTestMatch.index).trim() : markdown.trim();

	// Find all "## Test: Name" sections
	const testSections = markdown.matchAll(/^## Test: (.+?)$/gm);

	let index = 0;
	for (const match of testSections) {
		const name = match[1]?.trim();
		if (!name) {
			throw new Error(`Invalid fixture name in "${markdown}"`);
		}
		const startPos = match.index! + match[0].length;

		// Find next "## Test:" or end of file
		const nextTestMatch = markdown.substring(startPos).match(/^## Test:/m);
		const endPos = nextTestMatch ? startPos + nextTestMatch.index! : markdown.length;

		const section = markdown.substring(startPos, endPos);

		// Extract purpose
		const purposeMatch = section.match(/\*\*Purpose\*\*:\s*(.+?)$/m);
		const purpose = purposeMatch?.[1]?.trim();

		// Try to extract code block content
		const codeBlockMatch = section.match(/```([\w]*)\n([\s\S]*?)```/);

		let content: string | undefined;
		let languageTag: string | undefined;

		if (codeBlockMatch) {
			languageTag = codeBlockMatch[1];
			content = codeBlockMatch[2];
		} else {
			const contentMatch = section.match(/\n\n([\s\S]*?)(?:\n\n---(?:\n|$)|\n##|$)/);
			content = contentMatch?.[1]?.trim();
		}
		if (!content) {
			throw new Error(`Content not found for fixture "${name}"`);
		}

		fixtures.set(name, {
			name,
			purpose,
			content,
			index: index++,
			languageTag,
		});
	}

	return { header, fixtures };
}

/**
 * Serialize snapshots to markdown format
 *
 * Preserves language tag settings.
 */
export function writeFixtureFile(file: FixtureFile, defaultLanguageTag?: string): string {
	const parts: string[] = [];

	if (file.header) {
		parts.push(file.header);
		parts.push('');
	}

	for (const [name, fixture] of file.fixtures.entries()) {
		parts.push(`## Test: ${name}`);
		parts.push('');

		if (fixture.purpose) {
			parts.push(`**Purpose**: ${fixture.purpose}`);
			parts.push('');
		}

		const languageTag = fixture.languageTag ?? defaultLanguageTag;

		const content = fixture.content?.trimEnd();
		if (content) {
			if (languageTag) {
				parts.push('```' + languageTag);
				parts.push(content);
				parts.push('```');
			} else {
				// Raw content (no code block) - allows images, HTML, etc. to render
				parts.push(content);
			}
		}

		parts.push('');
		parts.push('---');
		parts.push('');
	}

	if (parts[parts.length - 1] === '' && parts[parts.length - 2] === '---') {
		parts.pop();
		parts.pop();
	}

	return parts.join('\n');
}
