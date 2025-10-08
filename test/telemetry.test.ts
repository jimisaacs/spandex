import { assert, assertEquals, assertExists } from '@std/assert';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import { TelemetryCollector, TelemetrySnapshot } from '../src/telemetry/index.ts';

const range = (r1?: number, r2?: number, c1?: number, c2?: number) => ({
	startRowIndex: r1,
	endRowIndex: r2,
	startColumnIndex: c1,
	endColumnIndex: c2,
});

Deno.test('Telemetry: Disabled telemetry has no overhead', () => {
	const telemetry = new TelemetryCollector({ enabled: false });
	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	// Should return same index (no-op wrapper)
	assertEquals(wrapped, index);
});

Deno.test('Telemetry: Collects insert metrics', () => {
	let reported: TelemetrySnapshot | undefined = undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 5,
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'backgroundColor');

	// Perform operations
	wrapped.insert(range(0, 5, 0, 5), 'red');
	wrapped.insert(range(5, 10, 0, 5), 'blue');
	wrapped.insert(range(10, 15, 0, 5), 'green');
	wrapped.insert(range(2, 7, 2, 7), 'yellow'); // Overlapping
	wrapped.getAllRanges(); // Trigger reporting

	assertExists(reported, 'telemetry should generate report');
	const snapshot = reported as TelemetrySnapshot; // Type-safe after assertExists
	assertEquals(snapshot.operations.inserts, 4);
	assertEquals(snapshot.propertyName, 'backgroundColor');
	assertEquals(snapshot.implementationName, 'MortonLinearScanImpl');
});

Deno.test('Telemetry: Detects overlapping inserts', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 4,
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	// Non-overlapping
	wrapped.insert(range(0, 5, 0, 5), 'a');
	wrapped.insert(range(5, 10, 0, 5), 'b');

	// Overlapping
	wrapped.insert(range(2, 7, 2, 7), 'c');

	wrapped.getAllRanges(); // Trigger (4 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.insertPatterns.sequential, 2);
	assertEquals(reported!.insertPatterns.overlapping, 1);
});

Deno.test('Telemetry: Tracks n distribution', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 6,
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	// Build up from n=1 to n=5
	wrapped.insert(range(0, 5, 0, 5), 'a');
	wrapped.insert(range(5, 10, 0, 5), 'b');
	wrapped.insert(range(10, 15, 0, 5), 'c');
	wrapped.insert(range(15, 20, 0, 5), 'd');
	wrapped.insert(range(20, 25, 0, 5), 'e');

	wrapped.getAllRanges(); // Trigger (6 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.nDistribution.min, 1);
	assertEquals(reported!.nDistribution.max, 5);
});

Deno.test('Telemetry: Collects query metrics', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 5,
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	wrapped.insert(range(0, 5, 0, 5), 'a');
	wrapped.insert(range(5, 10, 0, 5), 'b');

	// Small viewport query
	wrapped.query(range(0, 2, 0, 2));

	// Large query
	wrapped.query(range(0, 100, 0, 100));

	wrapped.getAllRanges(); // Trigger

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.operations.queries, 2);
});

Deno.test('Telemetry: Performance metrics captured', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 10,
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	// Generate some operations
	for (let i = 0; i < 10; i++) {
		wrapped.insert(range(i * 5, (i + 1) * 5, 0, 5), `value_${i}`);
	}

	wrapped.getAllRanges(); // Trigger

	assertExists(reported, 'telemetry should generate report');
	assertExists(reported!.performance.insertP50, 'should capture P50 insert time');
	assertExists(reported!.performance.insertP95, 'should capture P95 insert time');
	assertExists(reported!.performance.insertP99, 'should capture P99 insert time');
});

Deno.test('Telemetry: Force report works', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 1000, // Won't be reached
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	wrapped.insert(range(0, 5, 0, 5), 'a');

	// Force report before threshold
	const snapshot = telemetry.forceReport('MortonLinearScanImpl', 'test');

	assertExists(snapshot);
	assertEquals(snapshot.operations.inserts, 1);
});

Deno.test('Telemetry: Session ID included', () => {
	let reported: TelemetrySnapshot | undefined;

	const telemetry = new TelemetryCollector({
		enabled: true,
		reportingInterval: 2,
		sessionId: 'test-session-123',
		onReport: (snapshot) => {
			reported = snapshot;
		},
	});

	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	wrapped.insert(range(0, 5, 0, 5), 'a');
	wrapped.getAllRanges(); // Trigger (2 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.sessionId, 'test-session-123');
});
