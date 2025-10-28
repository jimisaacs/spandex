/** A1 notation adapter: "A1:C3" | "B:D" | "2:4" → Rectangle */

import type { RenderableIndexAdapter } from '../render/types.ts';
import type {
	ExtentResult,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from '../types.ts';
import { type GridRange, gridRangeToRectangle, rectangleToGridRange } from './gridrange.ts';

// Type-safe A1 range operations
// deno-fmt-ignore
export type A1Column = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
export type A1CellRange = `${A1Cell}:${A1Cell}`;
export type A1ColumnRange = `${A1Column}:${A1Column}`;
export type A1RowRange = `${number}:${number}`;
export type A1Cell = `${A1Column}${number}`;
export type A1SheetRange = A1Cell | A1CellRange | A1ColumnRange | A1RowRange;
// Future: higher-level range types
//export type A1SpreadsheetRange<Sheet extends string> = `${Sheet}!${A1SheetRange}`;
//export type A1Notation<Sheet extends string = string> = A1SheetRange | A1SpreadsheetRange<Sheet>;

/**
 * Convert 0-based column index to spreadsheet letter notation.
 *
 * @param col - Column index (0=A, 1=B, 25=Z, 26=AA, ...)
 * @returns Column letter(s). Negative columns prefixed with '-'.
 *
 * @example
 * ```typescript
 * columnToLetter(0)   // "A"
 * columnToLetter(25)  // "Z"
 * columnToLetter(26)  // "AA"
 * columnToLetter(-1)  // "-A"
 * ```
 */
export function columnToLetter(col: number): string {
	if (col < 0) return '-' + columnToLetter(-col - 1);
	if (col < 26) return String.fromCharCode(65 + col);
	return columnToLetter(Math.floor(col / 26) - 1) + columnToLetter(col % 26);
}

/** Convert column letter to 1-based index: A=1, B=2, ..., Z=26, AA=27, ... */
function letterToColumn(letter: string): number {
	return [...letter].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
}

function a1ToGridRange(a1: A1SheetRange): GridRange {
	// "A1" or "A1:B5"
	let m = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
	if (m) {
		const [, sc, sr, ec, er] = m;
		const c = letterToColumn(sc!) - 1;
		const r = parseInt(sr!) - 1;
		return {
			startRowIndex: r,
			startColumnIndex: c,
			endRowIndex: er ? parseInt(er) : r + 1,
			endColumnIndex: ec ? letterToColumn(ec) : c + 1,
		};
	}

	// "5:10"
	m = a1.match(/^(\d+):(\d+)$/);
	if (m) return { startRowIndex: parseInt(m[1]!) - 1, endRowIndex: parseInt(m[2]!) };

	// "A:C"
	m = a1.match(/^([A-Z]+):([A-Z]+)$/);
	if (m) return { startColumnIndex: letterToColumn(m[1]!) - 1, endColumnIndex: letterToColumn(m[2]!) };

	throw new Error(`Invalid A1 notation: ${a1}`);
}

function gridRangeToA1({ startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 }: GridRange) {
	const hasRow = r1 != null, hasCol = c1 != null;

	// Row range: "5:10"
	if (hasRow && r2 != null && !hasCol) return `${r1 + 1}:${r2}` as A1RowRange;

	// Column range: "A:C"
	if (hasCol && c2 != null && !hasRow) return `${columnToLetter(c1)}:${columnToLetter(c2 - 1)}` as A1ColumnRange;

	// Cell/range: "A1" or "A1:B5"
	if (hasRow && hasCol) {
		const start = `${columnToLetter(c1)}${r1 + 1}`;
		const isSingle = (!r2 || r2 === r1 + 1) && (!c2 || c2 === c1 + 1);
		if (isSingle) return start as A1Cell;
		if (r2 != null && c2 != null) return `${start}:${columnToLetter(c2 - 1)}${r2}` as A1CellRange;
	}

	throw new Error(`Cannot convert unbounded GridRange to A1: ${JSON.stringify({ r1, r2, c1, c2 })}`);
}

function a1ToRectangle(a1SheetRange: A1SheetRange): Readonly<Rectangle> {
	return gridRangeToRectangle(a1ToGridRange(a1SheetRange));
}

function rectangleToA1(bounds: Rectangle): A1SheetRange {
	return gridRangeToA1(rectangleToGridRange(bounds));
}

/**
 * Wrap SpatialIndex to accept/return A1 notation instead of Rectangle.
 *
 * Adapts a spatial index to work with spreadsheet A1 notation (e.g., "A1:C3", "B:D", "2:5")
 * while the core library uses Rectangle (closed intervals).
 *
 * @param index - Underlying spatial index to wrap
 * @returns Adapted index accepting A1SheetRange bounds
 *
 * @example
 * ```typescript
 * import { createA1Adapter } from '@jim/spandex/adapter/a1';
 * import createMortonLinearScanIndex from '@jim/spandex';
 *
 * const index = createMortonLinearScanIndex<string>();
 * const adapter = createA1Adapter(index);
 *
 * // Insert using A1 notation
 * adapter.insert('A1:C3', 'header');
 * adapter.insert('B:B', 'column_data');  // Full column
 * adapter.insert('5:10', 'row_range');   // Row range
 *
 * // Query using A1 notation
 * for (const [bounds, value] of adapter.query('B2:D5')) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export function createA1Adapter<T>(
	index: SpatialIndex<T>,
): SpatialIndex<T, A1SheetRange> & RenderableIndexAdapter<T, A1SheetRange> {
	return {
		insert(a1SheetRange: A1SheetRange, value: T): void {
			index.insert(a1ToRectangle(a1SheetRange), value);
		},
		query(a1SheetRange?: A1SheetRange): IterableIterator<QueryResult<T>> {
			return index.query(a1SheetRange ? a1ToRectangle(a1SheetRange) : undefined);
		},
		extent(): ExtentResult {
			return index.extent();
		},
		toBounds: rectangleToA1,
	} as const;
}

/**
 * Wrap PartitionedSpatialIndex to accept/return A1 notation instead of Rectangle.
 *
 * Adapts a partitioned spatial index to work with spreadsheet A1 notation for
 * per-attribute range management.
 *
 * @param index - Underlying partitioned spatial index to wrap
 * @returns Adapted partitioned index accepting A1SheetRange bounds
 *
 * @example
 * ```typescript
 * import { createPartitionedA1Adapter } from '@jim/spandex/adapter/a1';
 * import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 *
 * type CellProps = {
 *   background?: string;
 *   fontColor?: string;
 * };
 *
 * const index = createLazyPartitionedIndex<CellProps>(createMortonLinearScanIndex);
 * const adapter = createPartitionedA1Adapter(index);
 *
 * // Set individual attributes using A1 notation
 * adapter.set('A1:C3', 'background', 'red');
 * adapter.set('B2:D4', 'fontColor', 'blue');
 *
 * // Query returns merged attributes per cell
 * for (const [bounds, props] of adapter.query('B2:C3')) {
 *   console.log(bounds, props); // { background: 'red', fontColor: 'blue' }
 * }
 * ```
 */
export function createPartitionedA1Adapter<T extends Record<string, unknown>>(
	index: PartitionedSpatialIndex<T>,
): PartitionedSpatialIndex<Partial<T>, A1SheetRange> & RenderableIndexAdapter<Partial<T>, A1SheetRange> {
	return {
		set<K extends keyof T>(a1SheetRange: A1SheetRange, key: K, value: T[K]): void {
			index.set(a1ToRectangle(a1SheetRange), key, value);
		},
		insert(a1SheetRange: A1SheetRange, value: Partial<T>): void {
			index.insert(a1ToRectangle(a1SheetRange), value);
		},
		query(a1SheetRange?: A1SheetRange): IterableIterator<PartitionedQueryResult<T>> {
			return index.query(a1SheetRange ? a1ToRectangle(a1SheetRange) : undefined);
		},
		extent(): ExtentResult {
			return index.extent();
		},
		toBounds: rectangleToA1,
	} as const;
}
