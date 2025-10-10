import { assertEquals, assertExists } from '@std/assert';
import { MortonLinearScanImpl } from '@jim/spandex';
import { rect } from '@jim/spandex';
import { TelemetryCollector, TelemetrySnapshot } from '@local/spandex-telemetry';

Deno.test('Telemetry - Disabled telemetry has no overhead', () => {
	const telemetry = new TelemetryCollector({ enabled: false });
	const index = new MortonLinearScanImpl<string>();
	const wrapped = telemetry.wrap(index, 'test');

	// Should return same index (no-op wrapper)
	assertEquals(wrapped, index);
});

Deno.test('Telemetry - Collects insert metrics', () => {
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
	wrapped.insert(rect(0, 0, 4, 4), 'red');
	wrapped.insert(rect(0, 5, 4, 9), 'blue');
	wrapped.insert(rect(0, 10, 4, 14), 'green');
	wrapped.insert(rect(2, 2, 6, 6), 'yellow'); // Overlapping
	wrapped.query(); // Trigger reporting

	assertExists(reported, 'telemetry should generate report');
	const snapshot = reported as TelemetrySnapshot; // Type-safe after assertExists
	assertEquals(snapshot.operations.inserts, 4);
	assertEquals(snapshot.propertyName, 'backgroundColor');
	assertEquals(snapshot.implementationName, 'MortonLinearScanImpl');
});

Deno.test('Telemetry - Detects overlapping inserts', () => {
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
	wrapped.insert(rect(0, 0, 4, 4), 'a');
	wrapped.insert(rect(0, 5, 4, 9), 'b');

	// Overlapping
	wrapped.insert(rect(2, 2, 6, 6), 'c');

	wrapped.query(); // Trigger (4 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.insertPatterns.sequential, 2);
	assertEquals(reported!.insertPatterns.overlapping, 1);
});

Deno.test('Telemetry - Tracks n distribution', () => {
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
	wrapped.insert(rect(0, 0, 4, 4), 'a');
	wrapped.insert(rect(0, 5, 4, 9), 'b');
	wrapped.insert(rect(0, 10, 4, 14), 'c');
	wrapped.insert(rect(0, 15, 4, 19), 'd');
	wrapped.insert(rect(0, 20, 4, 24), 'e');

	wrapped.query(); // Trigger (6 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.nDistribution.min, 1);
	assertEquals(reported!.nDistribution.max, 5);
});

Deno.test('Telemetry - Collects query metrics', () => {
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

	wrapped.insert(rect(0, 0, 4, 4), 'a');
	wrapped.insert(rect(0, 5, 4, 9), 'b');

	// Small viewport query
	wrapped.query(rect(0, 0, 1, 1));

	// Large query
	wrapped.query(rect(0, 0, 99, 99));

	wrapped.query(); // Trigger

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.operations.queries, 2);
});

Deno.test('Telemetry - Performance metrics captured', () => {
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
		wrapped.insert(rect(0, i * 5, 4, (i + 1) * 5 - 1), `value_${i}`);
	}

	wrapped.query(); // Trigger

	assertExists(reported, 'telemetry should generate report');
	assertExists(reported!.performance.insertP50, 'should capture P50 insert time');
	assertExists(reported!.performance.insertP95, 'should capture P95 insert time');
	assertExists(reported!.performance.insertP99, 'should capture P99 insert time');
});

Deno.test('Telemetry - Force report works', () => {
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

	wrapped.insert(rect(0, 0, 4, 4), 'a');

	// Force report before threshold
	const snapshot = telemetry.forceReport('MortonLinearScanImpl', 'test');

	assertExists(snapshot);
	assertEquals(snapshot.operations.inserts, 1);
});

Deno.test('Telemetry - Session ID included', () => {
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

	wrapped.insert(rect(0, 0, 4, 4), 'a');
	wrapped.query(); // Trigger (2 ops total)

	assertExists(reported, 'telemetry should generate report');
	assertEquals(reported!.sessionId, 'test-session-123');
});
