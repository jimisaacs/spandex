/**
 * Google Sheets adapter: GridRange (half-open) ⟷ Rectangle (closed)
 */

/// <reference types="@types/google-apps-script" />

import { rect } from '../rect.ts';
import type { QueryResult, Rectangle, SpatialIndex } from '../types.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

/**
 * GridRange → Rectangle (lossless, undefined ⟷ ±Infinity)
 *
 * @example `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}` → `[0, 0, 9, 4]`
 */
export function gridRangeToRectangle(
	{
		startColumnIndex: x1 = -Infinity,
		startRowIndex: y1 = -Infinity,
		endColumnIndex: x2 = Infinity,
		endRowIndex: y2 = Infinity,
	}: GridRange,
): Rectangle {
	return rect(
		x1 < 0 ? -Infinity : x1,
		y1 < 0 ? -Infinity : y1,
		x2 < Infinity ? x2 - 1 : Infinity,
		y2 < Infinity ? y2 - 1 : Infinity,
	);
}

/**
 * Rectangle → GridRange (lossless, negative/Infinity → undefined)
 *
 * @example `[0, 0, 9, 4]` → `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}`
 */
export function rectangleToGridRange([x1, y1, x2, y2]: Rectangle): GridRange {
	const range: GridRange = {};
	if (x1 >= 0) range.startColumnIndex = x1;
	if (y1 >= 0) range.startRowIndex = y1;
	if (x2 < Infinity) range.endColumnIndex = x2 + 1;
	if (y2 < Infinity) range.endRowIndex = y2 + 1;
	return range;
}

/**
 * Wrap SpatialIndex to accept/return GridRange instead of Rectangle.
 */
export function createGridRangeAdapter<T>(index: SpatialIndex<T>) {
	return {
		insert(gridRange: GridRange, value: T): void {
			index.insert(gridRangeToRectangle(gridRange), value);
		},
		query(gridRange?: GridRange): IterableIterator<QueryResult<T>> {
			return index.query(gridRange ? gridRangeToRectangle(gridRange) : undefined);
		},
		get isEmpty(): boolean {
			return index.isEmpty;
		},
	} as const;
}

// Core Types
export type RangeValue = string | number | boolean | null;
export type Formula = `=${string}`;

// A1 notation types for type-safe range operations
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

function columnLetterToNumber(letter: string): number {
	return [...letter].reduce((result, char) => result * 26 + (char.charCodeAt(0) - 64), 0);
}

function numberToColumnLetter(num: number): string {
	let result = '';
	let n = num;
	while (n > 0) {
		const remainder = (n - 1) % 26;
		result = String.fromCharCode(65 + remainder) + result;
		n = Math.floor((n - 1) / 26);
	}
	return result || 'A';
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
		get isEmpty(): boolean {
			return index.isEmpty;
		},
	} as const;
}
