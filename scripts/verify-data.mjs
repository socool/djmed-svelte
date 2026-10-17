// Checks the parsing and statistics code against the bundled sample files.
// Run with: npm run verify:data   (Node 22+, uses built-in TypeScript stripping)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJsonl } from '../src/lib/data/parse.ts';
import { summarize, qualityNotes, percentile } from '../src/lib/data/stats.ts';
import { niceTicks, timeTicks, formatClock, nearestIndex } from '../src/lib/chart/scale.ts';

const read = (name) => readFileSync(new URL(`../static/samples/${name}`, import.meta.url), 'utf8');

function load(id) {
	const r = parseJsonl(read(`${id}.jsonl`), `${id}.jsonl`);
	assert.equal(r.warnings.length, 0, r.warnings.join('; '));
	assert.equal(r.sessions.length, 1);
	const s = r.sessions[0];
	assert.equal(s.meta.sessionId, id);
	assert.ok(s.minutes.every((m) => m.flow1.length === 600 && m.flow2.length === 600), `${id}: flow length`);
	return { s, sum: summarize(s) };
}

const counter = (sum, key) => sum.counters.find((c) => c.key === key);

// --- session 0100001 ---
const a = load('0100001');
assert.equal(a.s.minutes.length, 91);
assert.equal(formatClock(a.s.meta.start), '20:27');
assert.equal(a.sum.timeGaps, 0);
assert.equal(a.sum.pressure.min, 4.0);
assert.equal(a.sum.pressure.max, 5.4);
assert.equal(a.sum.hypopnea.total, 0);
assert.equal(counter(a.sum, 'b8').total, 4);
assert.equal(counter(a.sum, 'b10').total, 2);
assert.equal(a.sum.leakage.minutesAbove0, 7);

// --- session 0100002 ---
const b = load('0100002');
assert.equal(b.s.minutes.length, 108);
assert.equal(b.sum.pressure.max, 6.5);
assert.equal(b.sum.leakage.max, 0.7);
assert.equal(counter(b.sum, 'b8').total, 5);

// --- session 0100024: first file with hypopnea data ---
const c = load('0100024');
assert.equal(c.s.minutes.length, 145);
assert.equal(c.sum.hypopnea.total, 5);
assert.equal(c.sum.hypopnea.minutes, 5);
assert.equal(c.sum.pressure.max, 14.0);
assert.equal(counter(c.sum, 'b8').total, 58);
assert.equal(counter(c.sum, 'b5').total, 11);

// --- session 0100025 ---
const d = load('0100025');
assert.equal(d.s.minutes.length, 105);
assert.equal(d.sum.hypopnea.total, 10);
assert.equal(d.sum.hypopnea.minutes, 9);
assert.equal(counter(d.sum, 'b8').total, 38);
assert.equal(counter(d.sum, 'b10').total, 9);

// --- SpO2, pulse and central apnea are empty in every sample ---
for (const { sum } of [a, b, c, d]) {
	assert.equal(sum.spo2.minutes, 0);
	assert.equal(sum.pulse.minutes, 0);
	assert.equal(sum.central.total, 0);
}

// --- every session header agrees with its minute records ---
for (const { s, sum } of [a, b, c, d]) {
	assert.equal(sum.headerChecks.length, 5, s.meta.sessionId);
	for (const chk of sum.headerChecks) assert.ok(chk.ok, `${s.meta.sessionId}: ${chk.label} (header ${chk.expected}, records ${chk.actual})`);
	const titles = qualityNotes(s).map((n) => n.title).join(' | ');
	assert.match(titles, /duplicates pressure/);
	assert.match(titles, /SpO₂, pulse/);
	assert.doesNotMatch(titles, /header cross-check/);
}
assert.match(qualityNotes(c.s).map((n) => n.title).join(' | '), /No data recorded for central apnea, SpO₂, pulse/);
assert.doesNotMatch(qualityNotes(c.s).map((n) => n.title).join(' | '), /hypopnea/);

// --- error handling ---
const mixed = parseJsonl(read('0100002.jsonl') + '\nnot json\n{"record_type":"mystery"}\n', 'mixed');
assert.equal(mixed.sessions.length, 1);
assert.equal(mixed.warnings.length, 2);

// --- helpers ---
assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
assert.deepEqual(niceTicks(4, 6.5, 5), [4, 4.5, 5, 5.5, 6, 6.5]);
assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
assert.equal(nearestIndex([0, 10, 20, 30], 14), 1);
assert.equal(nearestIndex([0, 10, 20, 30], 16), 2);
const ticks = timeTicks(c.s.meta.start, c.s.meta.end);
assert.ok(ticks.length >= 3 && ticks.length <= 8);
assert.ok(ticks.every((t) => t % 60_000 === 0));

console.log('All data-layer checks passed.');
for (const { s, sum } of [a, b, c, d]) {
	console.log(
		`  ${s.meta.sessionId}: ${sum.records} min, pressure ${sum.pressure.min}-${sum.pressure.max}, hypopnea ${sum.hypopnea.total} in ${sum.hypopnea.minutes} min`
	);
}
