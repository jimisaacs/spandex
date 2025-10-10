/** Internal metric types for operation tracking */

export interface OperationMetric {
	timestamp: number;
	durationMs: number;
	n: number; // Range count at time of operation
}

export interface QueryMetric extends OperationMetric {
	queryArea: number; // GridRange area
}

export interface InsertMetric extends OperationMetric {
	hadOverlap: boolean;
	overlapArea?: number;
}
