/** ASCII parsing for spatial indexes */

import type { Rectangle } from '@jim/spandex';

export interface ParsedSnapshot {
	grid: string[][];
	legend: Map<string, string>;
	bounds: Rectangle;
}
function letterToCol(letter: string): number {
	let col = 0;
	for (let i = 0; i < letter.length; i++) {
		col = col * 26 + (letter.charCodeAt(i) - 65 + 1);
	}
	return col - 1;
}
export function parseAscii(ascii: string): ParsedSnapshot {
	const lines = ascii.split('\n').map((line) => line.trimEnd());

	const headerIdx = lines.findIndex((line) => /^[\s]*[A-Z]/.test(line));
	if (headerIdx === -1) throw new Error('No header row found');

	const header = lines[headerIdx];
	const colMatches = [...header.matchAll(/([A-Z]+)/g)];
	const startCol = colMatches.length ? letterToCol(colMatches[0][1]) : 0;
	const width = colMatches.length;

	const firstDataIdx = lines.findIndex((line, i) => i > headerIdx && /^\s*\d+\s*\|/.test(line));
	if (firstDataIdx === -1) throw new Error('No data rows found');

	const firstDataLine = lines[firstDataIdx];
	const rowMatch = firstDataLine.match(/^\s*(\d+)/);
	if (!rowMatch) throw new Error('Invalid row format');
	const startRow = parseInt(rowMatch[1], 10);

	const grid: string[][] = [];
	let currentIdx = firstDataIdx;

	while (currentIdx < lines.length) {
		const line = lines[currentIdx];
		if (!/^\s*\d+\s*\|/.test(line)) break;

		// Extract cells between | delimiters
		const cellsMatch = line.match(/\|(.*)\|$/);
		if (!cellsMatch) break;

		const cellsStr = cellsMatch[1];
		const cells = cellsStr.split('|').map((cell) => cell.trim()[0] || ' ');
		grid.push(cells);

		currentIdx += 2; // Skip data line + border line
	}

	const height = grid.length;

	// Parse legend (lines like "R = RED" or "B = \"BLUE\"")
	const legend = new Map<string, string>();
	for (let i = currentIdx; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const match = line.match(/^([A-Z\d+])\s*=\s*(.+)$/);
		if (match) {
			let value = match[2].trim();
			// Try parsing as JSON for quoted strings/objects
			if (value.startsWith('"') || value.startsWith('{') || value.startsWith('[')) {
				try {
					value = JSON.parse(value);
				} catch {
					// Keep as string if JSON parse fails
				}
			}
			legend.set(match[1], value);
		}
	}

	return {
		grid,
		legend,
		bounds: [startCol, startRow, startCol + width - 1, startRow + height - 1],
	};
}

/**
 * Extract non-empty regions from parsed snapshot.
 * Groups contiguous cells with the same symbol into maximal rectangles.
 */
export function snapshotToRegions(snapshot: ParsedSnapshot): Array<{ bounds: Rectangle; value: string }> {
	const { grid, legend, bounds } = snapshot;
	const [startCol, startRow] = bounds;

	const regions: Array<{ bounds: Rectangle; value: string }> = [];
	const visited = new Set<string>();

	for (let row = 0; row < grid.length; row++) {
		for (let col = 0; col < grid[row].length; col++) {
			const key = `${row},${col}`;
			if (visited.has(key)) continue;

			const symbol = grid[row][col];
			if (symbol === ' ') continue;

			// Find maximal rectangle starting at (row, col)
			let maxCol = col;
			while (maxCol + 1 < grid[row].length && grid[row][maxCol + 1] === symbol) {
				maxCol++;
			}

			let maxRow = row;
			let canExtend = true;
			while (canExtend && maxRow + 1 < grid.length) {
				for (let c = col; c <= maxCol; c++) {
					if (grid[maxRow + 1][c] !== symbol) {
						canExtend = false;
						break;
					}
				}
				if (canExtend) maxRow++;
			}

			for (let r = row; r <= maxRow; r++) {
				for (let c = col; c <= maxCol; c++) {
					visited.add(`${r},${c}`);
				}
			}

			const value = legend.get(symbol) || symbol;
			regions.push({
				bounds: [startCol + col, startRow + row, startCol + maxCol, startRow + maxRow],
				value,
			});
		}
	}

	return regions;
}
