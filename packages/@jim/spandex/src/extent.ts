import * as r from './r.ts';
import type { ExtentResult, QueryResult } from './types.ts';

/**
 * Compute extent (MBR + infinity edges) from query results.
 */
export function computeExtent<T>(results: Iterable<QueryResult<T>>): ExtentResult {
	let empty = true;
	let left = false, top = false, right = false, bottom = false;
	let xmin = r.posInf, xmax = r.negInf, ymin = r.posInf, ymax = r.negInf;

	for (const [[x1, y1, x2, y2]] of results) {
		empty = false;
		left ||= x1 === r.negInf, right ||= x2 === r.posInf;
		top ||= y1 === r.negInf, bottom ||= y2 === r.posInf;
		if (r.isFin(x1)) xmin = Math.min(xmin, x1), xmax = Math.max(xmax, x1);
		if (r.isFin(x2)) xmin = Math.min(xmin, x2), xmax = Math.max(xmax, x2);
		if (r.isFin(y1)) ymin = Math.min(ymin, y1), ymax = Math.max(ymax, y1);
		if (r.isFin(y2)) ymin = Math.min(ymin, y2), ymax = Math.max(ymax, y2);
	}
	// Replace sentinel infinities with 0
	xmin = r.isFin(xmin) ? xmin : 0;
	ymin = r.isFin(ymin) ? ymin : 0;
	xmax = r.isFin(xmax) ? xmax : 0;
	ymax = r.isFin(ymax) ? ymax : 0;

	const mbr = r.canonical([xmin, ymin, xmax, ymax]);
	const edges = empty ? r.ALL_EDGES : r.canonicalEdges([left, top, right, bottom]);
	return { mbr, edges, empty };
}
