/** Telemetry types: configuration and metrics snapshots */

export interface TelemetryConfig {
	/** Enable telemetry collection (default: false) */
	enabled: boolean;

	/** Report metrics every N operations (default: 1000) */
	reportingInterval?: number;

	/** Callback for sending metrics to your logging service */
	onReport?: (metrics: TelemetrySnapshot) => void;

	/** Custom session identifier (optional) */
	sessionId?: string;
}

export interface TelemetrySnapshot {
	/** When this snapshot was taken */
	timestamp: number;

	/** Session identifier */
	sessionId: string;

	/** Property name (e.g., 'backgroundColor', 'fontWeight') */
	propertyName: string;

	/** Implementation class name */
	implementationName: string;

	/** Distribution of n (range count) values */
	nDistribution: {
		min: number;
		max: number;
		mean: number;
		median: number;
		p95: number;
		p99: number;
		samples: number[];
	};

	/** Operation counts */
	operations: {
		inserts: number;
		queries: number;
		unboundedQueries: number; // query() with no bounds (returns all ranges)
	};

	/** Query patterns */
	queryPatterns: {
		/** Average query rectangle area */
		avgQueryArea: number;
		/** Queries covering >80% of space (full exports) */
		fullExportQueries: number;
		/** Queries covering <10% of space (viewport) */
		viewportQueries: number;
	};

	/** Insert patterns */
	insertPatterns: {
		/** Sequential non-overlapping inserts */
		sequential: number;
		/** Overlapping inserts (triggers decomposition) */
		overlapping: number;
		/** Average overlap area when overlaps occur */
		avgOverlapArea: number;
	};

	/** Performance metrics (milliseconds) */
	performance: {
		insertP50: number;
		insertP95: number;
		insertP99: number;
		queryP50: number;
		queryP95: number;
		queryP99: number;
	};
}
