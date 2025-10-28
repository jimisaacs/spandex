/**
 * Codec system for snapshot serialization
 *
 * ## Design Philosophy
 *
 * Codecs are composable transformations that control three aspects of snapshots:
 * 1. **Encoding**: How values are serialized to strings
 * 2. **Comparison**: How to determine equality (e.g., semantic vs lexical)
 * 3. **Rendering**: How content appears in markdown (code block vs raw)
 *
 * ## Architecture
 *
 * - **Base codecs**: Transform domain types to strings (json, binary, string)
 * - **Adapters**: Wrap codecs to add transformations (base64, data URIs)
 * - **Composition**: Chain adapters for complex encodings
 *
 * @module
 */

/**
 * Bidirectional codec for snapshot serialization
 *
 * Controls serialization, comparison, and markdown rendering.
 *
 * @template T The runtime type of values this codec handles
 */
export interface FixtureCodec<T> {
	/**
	 * Serialize a value to string for storage in markdown snapshots.
	 *
	 * **Required property**. Must be deterministic - same input always produces same output.
	 * Non-deterministic encoding causes spurious test failures.
	 *
	 * @param value The value to serialize
	 * @returns String representation for storage
	 */
	encode(value: T): string;

	/**
	 * Deserialize a string back to a value (optional).
	 *
	 * **Why optional**: Not all codecs are reversible (e.g., lossy compression, hashing).
	 * Only needed for round-trip testing via `assertRoundTrip()`.
	 *
	 * @param text The serialized string from snapshot
	 * @returns The deserialized value
	 */
	decode?(text: string): T;

	/**
	 * Compare two serialized strings for equality (optional).
	 *
	 * **Default**: Lexical comparison after trimming whitespace.
	 * **Override to**: Ignore formatting differences (e.g., JSON semantic comparison),
	 * normalize representations, or implement fuzzy matching.
	 *
	 * **Why custom comparison**: Allows `deno fmt` to reformat snapshots without breaking tests.
	 *
	 * @param actual The actual serialized output from current test run
	 * @param expected The expected serialized output from stored snapshot
	 * @returns true if values should be considered equal, false otherwise
	 */
	compare?(actual: string, expected: string): boolean;

	/**
	 * Language tag for markdown code blocks (optional).
	 *
	 * **Controls markdown rendering**:
	 * - **Present**: Content wrapped in ` ```languageTag ` code block (syntax highlighting)
	 * - **Undefined**: Content rendered as raw markdown (images/HTML can display)
	 *
	 * **Why optional**: Images and HTML require raw markdown to render properly.
	 *
	 * @example 'json' | 'yaml' | 'typescript' | 'ascii' | undefined
	 */
	languageTag?: string;
}

/**
 * Default comparison: trim and compare strings
 */
export function defaultCompare(actual: string, expected: string): boolean {
	return actual.trim() === expected.trim();
}

/**
 * JSON codec for any JSON-serializable type.
 *
 * Uses semantic comparison - ignores whitespace/formatting differences.
 * This allows `deno fmt` to reformat JSON in fixtures without breaking tests.
 *
 * @template T The type to serialize (must be JSON-serializable)
 */
export function jsonCodec<T = unknown>(): FixtureCodec<T> {
	return {
		encode: (value) => JSON.stringify(value, null, 2),
		decode: (text) => JSON.parse(text) as T,
		compare: (actual, expected) => {
			try {
				const actualParsed = JSON.parse(actual);
				const expectedParsed = JSON.parse(expected);
				return JSON.stringify(actualParsed) === JSON.stringify(expectedParsed);
			} catch {
				return actual.trim() === expected.trim();
			}
		},
		languageTag: 'json',
	};
}

/**
 * String codec (identity transform).
 *
 * Useful for raw text fixtures.
 *
 * @template T The string type (can be string literal union or branded type)
 */
export function stringCodec<T extends string = string>(): FixtureCodec<T> {
	return {
		encode: (value) => value,
		decode: (text) => text as T,
		compare: defaultCompare,
		languageTag: 'text',
	};
}

/**
 * Normalize ASCII string for comparison
 *
 * Trims trailing whitespace from each line and normalizes overall whitespace.
 * Useful for ASCII art where trailing spaces are insignificant.
 */
export function normalizeAscii(s: string): string {
	return s.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();
}

/**
 * ASCII string codec with whitespace normalization.
 *
 * Use for ASCII art or grid-based text where trailing whitespace should be ignored.
 * Comparison uses `normalizeAscii()` to ignore trailing whitespace on each line.
 *
 * @example
 * ```typescript
 * const { assertMatch } = createFixtureGroup(asciiStringCodec(), {
 *   filePath: url
 * });
 * await assertMatch(asciiGrid, { name: 'Test Grid' });
 * ```
 */
export function asciiStringCodec(): FixtureCodec<string> {
	return {
		encode: (value: string) => value,
		decode: (text: string) => text,
		compare: (actual: string, expected: string) => normalizeAscii(actual) === normalizeAscii(expected),
		languageTag: 'ascii',
	};
}

/**
 * Binary codec for Uint8Array data.
 *
 * Identity codec for binary data - useful as a base for adapters.
 *
 * @template T The binary type (typically Uint8Array or subclass)
 *
 * @example
 * ```typescript
 * const codec = binaryCodec();
 * const data = new Uint8Array([72, 101, 108, 108, 111]);
 * codec.encode(data); // Raw bytes as string
 * ```
 */
export function binaryCodec(): FixtureCodec<Uint8Array> {
	return {
		encode: (data) => String.fromCharCode(...(data as unknown as Uint8Array)),
		decode: (text: string) => new Uint8Array([...text].map((c) => c.charCodeAt(0))),
		compare: defaultCompare,
		languageTag: 'binary',
	} as const;
}

/**
 * Base64 adapter - wraps a codec to encode its output as base64.
 *
 * Adapts any codec that produces string output to base64 encoding.
 *
 * @example
 * ```typescript
 * // Base64-encoded binary data
 * const codec = base64Adapter(binaryCodec());
 *
 * // Base64-encoded JSON
 * const jsonBase64 = base64Adapter(jsonCodec<User>());
 * ```
 */
export function base64Adapter<T>(innerCodec: FixtureCodec<T>): FixtureCodec<T> {
	const codec: FixtureCodec<T> = {
		encode: (value: T) => btoa(innerCodec.encode(value)),
		compare: defaultCompare,
		languageTag: 'base64',
	};
	if (innerCodec.decode) codec.decode = (text: string) => innerCodec.decode!(atob(text.trim())) as T;
	return codec;
}

/**
 * Data URI adapter - wraps a codec to create data URIs.
 *
 * Useful for embedding images or other media in markdown fixtures.
 * The output will display when the markdown is rendered!
 *
 * @param innerCodec The codec to wrap (typically base64-encoded)
 * @param mimeType MIME type for the data URI (e.g., 'image/png', 'image/svg+xml')
 *
 * @example
 * ```typescript
 * // Image data URI (displays in markdown)
 * const codec = dataUriAdapter(base64Adapter(binaryCodec()), 'image/svg+xml');
 *
 * // Or as shorthand helper:
 * const imageCodec = imageDataUriCodec('image/png');
 * ```
 */
export function dataUriAdapter<T>(innerCodec: FixtureCodec<T>, mimeType: string): FixtureCodec<T> {
	const codec: FixtureCodec<T> = {
		encode: (value: T) => {
			const encoded = innerCodec.encode(value);
			return `![Image](data:${mimeType};base64,${encoded})`;
		},
		compare: defaultCompare,
		// No languageTag = raw markdown (so images display!)
	};
	if (innerCodec.decode) {
		codec.decode = (text: string) => {
			const match = text.match(/data:[^;]+;base64,([^)]+)/);
			if (!match) throw new Error('Invalid data URI in fixture');
			return innerCodec.decode!(match[1]!);
		};
	}
	return codec;
}

/**
 * Helper: Image data URI codec (composed from adapters).
 *
 * Convenience function that combines binaryCodec + base64Adapter + dataUriAdapter.
 *
 * @param mimeType Image MIME type (e.g., 'image/png', 'image/svg+xml')
 *
 * @example
 * ```typescript
 * const codec = imageDataUriCodec('image/png');
 * const pngData = new Uint8Array([...]); // PNG bytes
 * codec.encode(pngData); // "![Image](data:image/png;base64,...)"
 * ```
 */
export function imageDataUriCodec(mimeType: string): FixtureCodec<Uint8Array> {
	return dataUriAdapter(base64Adapter(binaryCodec()), mimeType);
}
