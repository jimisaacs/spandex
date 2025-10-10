/** A1 notation adapter: "A1:C3" | "B:D" | "2:4" → Rectangle */

import type {
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from '../types.ts';
import { type GridRange, gridRangeToRectangle } from './gridrange.ts';

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

/** Convert column letter to 0-based index: A=0, B=1, ..., Z=25, AA=26, ... */
function columnLetterToNumber(letter: string): number {
	return [...letter].reduce((result, char) => result * 26 + (char.charCodeAt(0) - 64), 0);
}

function a1ToGridRange(a1Notation: A1SheetRange): GridRange {
	const gridRange: GridRange = {};

	// Cell patterns: "A1", "A1:B5"
	const cellMatch = a1Notation.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
	if (cellMatch) {
		const [, startCol, startRow, endCol, endRow] = cellMatch;
		const startColIndex = columnLetterToNumber(startCol) - 1;
		const startRowIndex = parseInt(startRow) - 1;

		gridRange.startRowIndex = startRowIndex;
		gridRange.startColumnIndex = startColIndex;
		gridRange.endRowIndex = endRow ? parseInt(endRow) : parseInt(startRow);
		gridRange.endColumnIndex = endCol ? columnLetterToNumber(endCol) : startColIndex + 1;
		return gridRange;
	}

	// Row ranges: "5:10"
	const rowMatch = a1Notation.match(/^(\d+):(\d+)$/);
	if (rowMatch) {
		const [, startRow, endRow] = rowMatch;
		gridRange.startRowIndex = parseInt(startRow) - 1;
		gridRange.endRowIndex = parseInt(endRow);
		return gridRange;
	}

	// Column ranges: "A:C"
	const colMatch = a1Notation.match(/^([A-Z]+):([A-Z]+)$/);
	if (colMatch) {
		const [, startCol, endCol] = colMatch;
		gridRange.startColumnIndex = columnLetterToNumber(startCol) - 1;
		gridRange.endColumnIndex = columnLetterToNumber(endCol);
		return gridRange;
	}

	throw new Error(`Invalid A1 notation: ${a1Notation}`);
}

function a1ToRectangle(a1SheetRange: A1SheetRange): Rectangle {
	return gridRangeToRectangle(a1ToGridRange(a1SheetRange));
}

/**
 * A1SheetRange → Rectangle (lossless, undefined ⟷ ±Infinity)
 */
export function createA1Adapter<T>(index: SpatialIndex<T>) {
	return {
		insert(a1SheetRange: A1SheetRange, value: T): void {
			index.insert(a1ToRectangle(a1SheetRange), value);
		},
		query(a1SheetRange?: A1SheetRange): IterableIterator<QueryResult<T>> {
			return index.query(a1SheetRange ? a1ToRectangle(a1SheetRange) : undefined);
		},
	} as const;
}

export function createPartitionedA1Adapter<T extends Record<string, unknown>>(
	index: PartitionedSpatialIndex<T>,
) {
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
	} as const;
}
