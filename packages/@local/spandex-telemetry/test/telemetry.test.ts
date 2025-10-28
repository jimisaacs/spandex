import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { TelemetryCollector, type TelemetrySnapshot } from '@local/spandex-telemetry';
import { assertEquals, assertExists } from '@std/assert';

Deno.test('Telemetry', async (t) => {
	await t.step('Disabled telemetry has no overhead', () => {
		const telemetry = new TelemetryCollector({ enabled: false });
		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		// Should return same index (no-op wrapper)
		assertEquals(wrapped, index);
	});

	await t.step('Collects insert metrics', () => {
		let reported: TelemetrySnapshot | undefined = undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 5,
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'backgroundColor');

		// Perform operations
		wrapped.insert(r.make(0, 0, 4, 4), 'red');
		wrapped.insert(r.make(0, 5, 4, 9), 'blue');
		wrapped.insert(r.make(0, 10, 4, 14), 'green');
		wrapped.insert(r.make(2, 2, 6, 6), 'yellow'); // Overlapping
		wrapped.query(); // Trigger reporting

		assertExists(reported, 'telemetry should generate report');
		const snapshot = reported as TelemetrySnapshot; // Type-safe after assertExists
		assertEquals(snapshot.operations.inserts, 4);
		assertEquals(snapshot.propertyName, 'backgroundColor');
		assertEquals(snapshot.implementationName, 'MortonLinearScanImpl');
	});

	await t.step('Detects overlapping inserts', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 4,
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		// Non-overlapping
		wrapped.insert(r.make(0, 0, 4, 4), 'a');
		wrapped.insert(r.make(0, 5, 4, 9), 'b');

		// Overlapping
		wrapped.insert(r.make(2, 2, 6, 6), 'c');

		wrapped.query(); // Trigger (4 ops total)

		assertExists(reported, 'telemetry should generate report');
		assertEquals(reported!.insertPatterns.sequential, 2);
		assertEquals(reported!.insertPatterns.overlapping, 1);
	});

	await t.step('Tracks n distribution', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 6,
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		// Build up from n=1 to n=5
		wrapped.insert(r.make(0, 0, 4, 4), 'a');
		wrapped.insert(r.make(0, 5, 4, 9), 'b');
		wrapped.insert(r.make(0, 10, 4, 14), 'c');
		wrapped.insert(r.make(0, 15, 4, 19), 'd');
		wrapped.insert(r.make(0, 20, 4, 24), 'e');

		wrapped.query(); // Trigger (6 ops total)

		assertExists(reported, 'telemetry should generate report');
		assertEquals(reported!.nDistribution.min, 1);
		assertEquals(reported!.nDistribution.max, 5);
	});

	await t.step('Collects query metrics', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 5,
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		wrapped.insert(r.make(0, 0, 4, 4), 'a');
		wrapped.insert(r.make(0, 5, 4, 9), 'b');

		// Small viewport query
		wrapped.query(r.make(0, 0, 1, 1));

		// Large query
		wrapped.query(r.make(0, 0, 99, 99));

		wrapped.query(); // Trigger

		assertExists(reported, 'telemetry should generate report');
		assertEquals(reported!.operations.queries, 2);
	});

	await t.step('Performance metrics captured', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 10,
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		// Generate some operations
		for (let i = 0; i < 10; i++) {
			wrapped.insert(r.make(0, i * 5, 4, (i + 1) * 5 - 1), `value_${i}`);
		}

		wrapped.query(); // Trigger

		assertExists(reported, 'telemetry should generate report');
		assertExists(reported!.performance.insertP50, 'should capture P50 insert time');
		assertExists(reported!.performance.insertP95, 'should capture P95 insert time');
		assertExists(reported!.performance.insertP99, 'should capture P99 insert time');
	});

	await t.step('Force report works', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 1000, // Won't be reached
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		wrapped.insert(r.make(0, 0, 4, 4), 'a');

		// Force report before threshold
		const snapshot = telemetry.forceReport('MortonLinearScanImpl', 'test');

		assertExists(snapshot);
		assertEquals(snapshot.operations.inserts, 1);
	});

	await t.step('Session ID included', () => {
		let reported: TelemetrySnapshot | undefined;

		const telemetry = new TelemetryCollector({
			enabled: true,
			reportingInterval: 2,
			sessionId: 'test-session-123',
			onReport: (snapshot) => {
				reported = snapshot;
			},
		});

		const index = createMortonLinearScanIndex<string>();
		const wrapped = telemetry.wrap(index, 'test');

		wrapped.insert(r.make(0, 0, 4, 4), 'a');
		wrapped.query(); // Trigger (2 ops total)

		assertExists(reported, 'telemetry should generate report');
		assertEquals(reported!.sessionId, 'test-session-123');
	});
});
