/** Coordinate conversion for ASCII grids (0-based: A=0, B=1, Z=25) */

/** Convert column number to spreadsheet letter (0→A, 25→Z, 26→AA, negatives get '-' prefix) */
export function columnToLetter(col: number): string {
	if (col < 0) return '-' + columnToLetter(-col - 1);
	if (col < 26) return String.fromCharCode(65 + col);
	return columnToLetter(Math.floor(col / 26) - 1) + columnToLetter(col % 26);
}

/** Convert column letter to 0-based index: A=0, B=1, ..., Z=25, AA=26, ... */
export function letterToColumn(letter: string): number {
	if (letter.startsWith('-')) {
		const positiveCol = letterToColumn(letter.substring(1));
		return -(positiveCol + 1);
	}

	let col = 0;
	for (let i = 0; i < letter.length; i++) {
		col = col * 26 + (letter.charCodeAt(i) - 65 + 1);
	}
	return col - 1;
}

/** Format row number for display (negatives stay negative, non-negatives use 1-based indexing) */
export function formatRowNumber(row: number): string {
	return String(row < 0 ? row : row + 1);
}

/** Parse row label to row number (1-based → 0-based, negatives unchanged) */
export function parseRowLabel(label: string): number {
	const num = parseInt(label, 10);
	return num < 0 ? num : num - 1;
}
