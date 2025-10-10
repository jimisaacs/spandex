/** ASCII rendering for spatial indexes */

import type { Rectangle, SpatialIndex } from '@jim/spandex';

const CELL_WIDTH = 3;
const CELL_SEPARATOR = '|';
const BORDER_CHAR = '+';
const BORDER_LINE = '---';
const COLUMN_SEPARATOR = ' ';

export interface RenderOptions {
	width: number;
	height: number;
	startCol?: number;
	startRow?: number;
	valueFormatter?: (value: unknown) => string;
}
function colToLetter(col: number): string {
	if (col < 26) return String.fromCharCode(65 + col);
	return colToLetter(Math.floor(col / 26) - 1) + colToLetter(col % 26);
}
export function renderToAscii<T>(index: SpatialIndex<T>, options: RenderOptions): string {
	const { width, height, startCol = 0, startRow = 0, valueFormatter = (v) => String(v)[0] } = options;
	const viewport: Rectangle = [startCol, startRow, startCol + width - 1, startRow + height - 1];

	const { grid, legend } = buildGridFromResults(index.query(viewport), {
		width,
		height,
		startCol,
		startRow,
		valueFormatter,
	});

	return renderGridToAscii(grid, legend, { width, height, startCol, startRow });
}
function buildGridFromResults<T>(
	results: IterableIterator<readonly [Rectangle, T]>,
	options: { width: number; height: number; startCol: number; startRow: number; valueFormatter: (v: T) => string },
): { grid: string[][]; legend: Map<string, Set<T>> } {
	const { width, height, startCol, startRow, valueFormatter } = options;

	const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
	const legend = new Map<string, Set<T>>();

	for (const [bounds, value] of results) {
		const [x1, y1, x2, y2] = bounds;
		const symbol = valueFormatter(value);

		if (!legend.has(symbol)) {
			legend.set(symbol, new Set());
		}
		legend.get(symbol)!.add(value);
		const viewportStartRow = startRow;
		const viewportEndRow = startRow + height - 1;
		const viewportStartCol = startCol;
		const viewportEndCol = startCol + width - 1;

		for (let row = Math.max(y1, viewportStartRow); row <= Math.min(y2, viewportEndRow); row++) {
			for (let col = Math.max(x1, viewportStartCol); col <= Math.min(x2, viewportEndCol); col++) {
				grid[row - startRow][col - startCol] = symbol;
			}
		}
	}

	return { grid, legend };
}

function renderGridToAscii<T>(
	grid: string[][],
	legend: Map<string, Set<T>>,
	viewport: { width: number; height: number; startCol: number; startRow: number },
): string {
	const { width, height, startCol, startRow } = viewport;
	const lines: string[] = [];

	const maxRowNumber = startRow + height - 1;
	const rowLabelWidth = String(maxRowNumber).length;

	lines.push(renderColumnHeader(width, startCol, rowLabelWidth));

	const border = renderBorder(width, rowLabelWidth);
	lines.push(border);

	for (let rowIdx = 0; rowIdx < height; rowIdx++) {
		const rowNumber = startRow + rowIdx;
		lines.push(renderDataRow(grid[rowIdx], rowNumber, rowLabelWidth));
		lines.push(border);
	}

	if (legend.size) {
		lines.push('');
		lines.push(...renderLegend(legend));
	}

	return lines.join('\n');
}
function renderColumnHeader(width: number, startCol: number, rowLabelWidth: number): string {
	const padding = ' '.repeat(rowLabelWidth + 3);
	const columns = Array.from({ length: width }, (_, i) => {
		return colToLetter(startCol + i).padEnd(CELL_WIDTH, ' ');
	}).join(COLUMN_SEPARATOR);
	return padding + columns;
}
function renderBorder(width: number, rowLabelWidth: number): string {
	const padding = ' '.repeat(rowLabelWidth);
	const borderSegment = BORDER_LINE + BORDER_CHAR;
	return padding + ' ' + BORDER_CHAR + borderSegment.repeat(width);
}
function renderDataRow(rowCells: string[], rowNumber: number, rowLabelWidth: number): string {
	const rowLabel = String(rowNumber).padStart(rowLabelWidth, ' ');
	const cells = rowCells.map((cell) => ` ${cell} `).join(CELL_SEPARATOR);
	return `${rowLabel} ${CELL_SEPARATOR}${cells}${CELL_SEPARATOR}`;
}
function renderLegend<T>(legend: Map<string, Set<T>>): string[] {
	const entries = [...legend.entries()].sort();
	return entries.map(([symbol, values]) => {
		const descriptions = [...values].map((v) => JSON.stringify(v)).join(', ');
		return `${symbol} = ${descriptions}`;
	});
}
export function assertSnapshot(actual: string, expected: string): void {
	const normalizeLines = (s: string) => s.split('\n').map((line) => line.trimEnd()).filter((line) => line.length > 0);

	const actualLines = normalizeLines(actual);
	const expectedLines = normalizeLines(expected);

	if (actualLines.length !== expectedLines.length) {
		throw new Error(
			`Snapshot mismatch: Different number of lines\nExpected ${expectedLines.length} lines, got ${actualLines.length}\n\n` +
				`Expected:\n${expected}\n\nActual:\n${actual}`,
		);
	}

	for (let i = 0; i < actualLines.length; i++) {
		if (actualLines[i] !== expectedLines[i]) {
			throw new Error(
				`Snapshot mismatch at line ${i + 1}:\nExpected: "${expectedLines[i]}"\nActual:   "${
					actualLines[i]
				}"\n\n` +
					`Full expected:\n${expected}\n\nFull actual:\n${actual}`,
			);
		}
	}
}
