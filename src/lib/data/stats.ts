import type { CounterInfo, HeaderCheck, MinuteRecord, QualityNote, Session, Summary } from './types';

export function mean(values: number[]): number {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Linear-interpolated percentile, p in [0, 1]. */
export function percentile(values: number[], p: number): number {
	if (!values.length) return 0;
	const s = [...values].sort((a, b) => a - b);
	const pos = (s.length - 1) * p;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Peak-to-peak range of a waveform. */
export function amplitude(samples: number[]): number {
	if (!samples.length) return 0;
	let lo = samples[0];
	let hi = samples[0];
	for (const v of samples) {
		if (v < lo) lo = v;
		if (v > hi) hi = v;
	}
	return hi - lo;
}

/**
 * Unlabeled count-like bytes in each minute record. "b8" is byte 8 of the record, etc.
 * Byte 12 is left out: it holds larger, differently-behaved values.
 */
export const COUNTER_DEFS: { key: string; label: string; pick: (r: MinuteRecord) => number }[] = [
	{ key: 'b5', label: 'Byte 5', pick: (r) => r.unk05[0] },
	{ key: 'b6', label: 'Byte 6', pick: (r) => r.unk05[1] },
	{ key: 'b7', label: 'Byte 7', pick: (r) => r.unk05[2] },
	{ key: 'b8', label: 'Byte 8', pick: (r) => r.unk05[3] },
	{ key: 'b10', label: 'Byte 10', pick: (r) => r.unk10[0] },
	{ key: 'b11', label: 'Byte 11', pick: (r) => r.unk10[1] },
	{ key: 'b13', label: 'Byte 13', pick: (r) => r.unk10[3] },
	{ key: 'b14', label: 'Byte 14', pick: (r) => r.unk10[4] }
];

function counterInfo(m: MinuteRecord[]): CounterInfo[] {
	return COUNTER_DEFS.map((d) => {
		const vals = m.map(d.pick);
		return { key: d.key, label: d.label, total: vals.reduce((a, b) => a + b, 0), minutes: vals.filter((v) => v > 0).length };
	}).filter((c) => c.total > 0);
}

function nonZeroRange(values: number[]): { minutes: number; min: number; max: number } {
	const nz = values.filter((v) => v > 0);
	return { minutes: nz.length, min: nz.length ? Math.min(...nz) : 0, max: nz.length ? Math.max(...nz) : 0 };
}

/**
 * Compare totals computed from the minute records with the 16-bit words in the session header.
 * Words 5, 9 and 13 held leakage total, mean pressure and record count in every sample file;
 * words 4 and 6 matched the totals of record bytes 8 and 10.
 */
function headerChecks(session: Session, counters: CounterInfo[]): HeaderCheck[] {
	const w = session.meta.summaryWords;
	const m = session.minutes;
	if (w.length < 15 || !m.length) return [];
	const total = (key: string) => counters.find((c) => c.key === key)?.total ?? 0;
	const meanPressureRaw = mean(m.map((r) => r.pressureRaw));
	return [
		{ label: 'Record count = header word 13', expected: w[13], actual: m.length, ok: w[13] === m.length },
		{
			label: 'Leakage total = header word 5',
			expected: w[5],
			actual: m.reduce((a, r) => a + r.leakageRaw, 0),
			ok: w[5] === m.reduce((a, r) => a + r.leakageRaw, 0)
		},
		{
			label: 'Mean pressure (raw) within 1 of header word 9',
			expected: w[9],
			actual: Math.round(meanPressureRaw * 10) / 10,
			ok: Math.abs(w[9] - meanPressureRaw) < 1
		},
		{ label: 'Byte 8 total = header word 4', expected: w[4], actual: total('b8'), ok: w[4] === total('b8') },
		{ label: 'Byte 10 total = header word 6', expected: w[6], actual: total('b10'), ok: w[6] === total('b10') }
	];
}

export function summarize(session: Session): Summary {
	const m = session.minutes;
	const pressure = m.map((r) => r.pressure);
	const leak = m.map((r) => r.leakage);
	let gaps = 0;
	for (let i = 1; i < m.length; i++) if (m[i].t - m[i - 1].t !== 60_000) gaps++;
	const { start, end } = session.meta;
	const counters = counterInfo(m);
	return {
		durationMin: Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 60_000) : m.length,
		records: m.length,
		pressure: {
			min: pressure.length ? Math.min(...pressure) : 0,
			mean: mean(pressure),
			median: percentile(pressure, 0.5),
			p95: percentile(pressure, 0.95),
			max: pressure.length ? Math.max(...pressure) : 0
		},
		leakage: {
			mean: mean(leak),
			max: leak.length ? Math.max(...leak) : 0,
			minutesAbove0: m.filter((r) => r.leakageRaw > 0).length
		},
		hypopnea: { total: m.reduce((a, r) => a + r.hypopneaRaw, 0), minutes: m.filter((r) => r.hypopneaRaw > 0).length },
		central: { total: m.reduce((a, r) => a + r.centralRaw, 0), minutes: m.filter((r) => r.centralRaw > 0).length },
		spo2: nonZeroRange(m.map((r) => r.spo2Raw)),
		pulse: nonZeroRange(m.map((r) => r.pulseRaw)),
		counters,
		headerChecks: headerChecks(session, counters),
		flowAmplitude: {
			flow1Mean: mean(m.map((r) => amplitude(r.flow1))),
			flow2Mean: mean(m.map((r) => amplitude(r.flow2)))
		},
		timeGaps: gaps
	};
}

/** Things the viewer should tell the user about, derived from the data itself. */
export function qualityNotes(session: Session): QualityNote[] {
	const m = session.minutes;
	const notes: QualityNote[] = [];
	if (!m.length) {
		notes.push({ level: 'warning', title: 'No minute records', detail: 'This session has a header but no minute_summary records.' });
		return notes;
	}
	const s = summarize(session);

	const dup = m.filter((r) => r.obstructiveRaw === r.pressureRaw).length;
	if (dup === m.length && m.some((r) => r.pressureRaw !== 0)) {
		notes.push({
			level: 'warning',
			title: '"obstructive_apnea_events" duplicates pressure',
			detail:
				'In every minute this field equals pressure_raw, so it cannot be an event count. It is not charted as apneas; the field offsets in the export are probably misaligned.'
		});
	}

	const empty: string[] = [];
	if (s.central.total === 0) empty.push('central apnea');
	if (s.hypopnea.total === 0) empty.push('hypopnea');
	if (s.spo2.minutes === 0) empty.push('SpO₂');
	if (s.pulse.minutes === 0) empty.push('pulse');
	if (empty.length) {
		notes.push({
			level: 'info',
			title: `No data recorded for ${empty.join(', ')}`,
			detail:
				'These fields are 0 in every minute of this session. If your device or its own report shows values for them, the export is not decoding them (or this device has no oximeter), and no chart can recover them from this file.'
		});
	}

	if (s.timeGaps > 0) {
		notes.push({ level: 'warning', title: `${s.timeGaps} gap(s) in the minute series`, detail: 'Some consecutive records are not exactly 60 s apart; lines are drawn straight across the gap.' });
	}

	const badFlow = m.filter((r) => r.flow1.length !== 600 || r.flow2.length !== 600).length;
	if (badFlow) {
		notes.push({ level: 'warning', title: `${badFlow} minute(s) without a full 600-sample flow trace`, detail: 'Their waveform may look shorter than 60 s.' });
	}

	const bad = s.headerChecks.filter((c) => !c.ok);
	if (bad.length) {
		notes.push({
			level: 'warning',
			title: `${bad.length} header cross-check(s) do not match`,
			detail: bad.map((c) => `${c.label} (header ${c.expected}, records ${c.actual})`).join('; ') + '.'
		});
	}

	notes.push({
		level: 'info',
		title: 'Flow, leakage and the unlabeled counters have no established scale',
		detail:
			'Flow channels are raw bytes at 10 Hz. Leakage is raw ÷ 10 with no established unit. The unlabeled counter bytes are shown as counts of unknown type; two of them match totals in the session header, which suggests they are event counts.'
	});
	return notes;
}
