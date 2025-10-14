/** Shared constants for ASCII rendering and parsing */

export const CELL_WIDTH = 3;
export const CELL_SEPARATOR = '|';
export const BORDER_CHAR = '+';
export const BORDER_LINE = '---';
export const COLUMN_SEPARATOR = ' ';
export const EMPTY_CELL = ' ';
export const INFINITY_SYMBOL = '∞';
export const ABSOLUTE_ORIGIN_MARKER = '*';

/**
 * ASCII grid format structure: each data row is followed by a border line.
 *
 * Used by parse.ts to skip through rendered output (stride of 2).
 * Produced by render.ts via explicit line-by-line construction.
 */
export const GRID_ROW_STRIDE = 2;
