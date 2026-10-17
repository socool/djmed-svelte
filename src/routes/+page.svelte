<script lang="ts">
	import FileLoader from '$lib/components/FileLoader.svelte';
	import LineChart from '$lib/components/LineChart.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { summarize, qualityNotes, amplitude, COUNTER_DEFS } from '$lib/data/stats';
	import { formatClock, formatDateTime, formatDuration, nearestIndex } from '$lib/chart/scale';
	import type { Session } from '$lib/data/types';

	// Large arrays: keep them out of Svelte's deep reactivity proxies.
	let sessions = $state.raw<Session[]>([]);
	let warnings = $state.raw<string[]>([]);
	let selectedId = $state('');
	let minuteIndex = $state(0);

	const session = $derived(sessions.find((s) => s.meta.sessionId === selectedId) ?? sessions[0]);
	const minutes = $derived(session?.minutes ?? []);
	const summary = $derived(session ? summarize(session) : null);
	const notes = $derived(session ? qualityNotes(session) : []);
	const safeIndex = $derived(Math.min(minuteIndex, Math.max(0, minutes.length - 1)));
	const current = $derived(minutes[safeIndex]);
	const minuteTimes = $derived(minutes.map((m) => m.t));

	const xDomain = $derived<[number, number] | undefined>(
		minutes.length ? [minutes[0].t, minutes[minutes.length - 1].t + 60_000] : undefined
	);

	function withTail<T extends { x: number; y: number }>(points: T[]): { x: number; y: number }[] {
		// Step lines need a closing point so the final minute is drawn with its full width.
		const last = points[points.length - 1];
		return last ? [...points, { x: last.x + 60_000, y: last.y }] : points;
	}

	const pressureSeries = $derived([
		{
			label: 'Pressure (cmH₂O)',
			color: 'var(--chart-1)',
			step: true,
			points: withTail(minutes.map((m) => ({ x: m.t, y: m.pressure })))
		}
	]);
	const leakSeries = $derived([
		{
			label: 'Leakage (raw ÷ 10)',
			color: 'var(--chart-2)',
			step: true,
			points: withTail(minutes.map((m) => ({ x: m.t, y: m.leakage })))
		}
	]);
	const flowAmpSeries = $derived([
		{
			label: 'Flow channel 1',
			color: 'var(--chart-1)',
			points: minutes.map((m) => ({ x: m.t, y: amplitude(m.flow1) }))
		},
		{
			label: 'Flow channel 2',
			color: 'var(--chart-2)',
			dash: '6 3',
			points: minutes.map((m) => ({ x: m.t, y: amplitude(m.flow2) }))
		}
	]);
	const hasOximetry = $derived(!!summary && (summary.spo2.minutes > 0 || summary.pulse.minutes > 0));

	const eventLabel = (m: { t: number; hypopneaRaw: number }) =>
		`${formatClock(m.t)}: ${m.hypopneaRaw} hypopnea event${m.hypopneaRaw === 1 ? '' : 's'}`;
	// Same minutes, placed on the pressure chart and on the event chart respectively.
	const pressureMarkers = $derived(
		minutes.filter((m) => m.hypopneaRaw > 0).map((m) => ({ x: m.t, y: m.pressure, label: eventLabel(m) }))
	);
	const eventMarkers = $derived(
		minutes.filter((m) => m.hypopneaRaw > 0).map((m) => ({ x: m.t, y: m.hypopneaRaw, label: eventLabel(m) }))
	);
	const eventSeries = $derived([
		{
			label: 'Hypopnea events per minute',
			color: 'var(--chart-1)',
			step: true,
			points: withTail(minutes.map((m) => ({ x: m.t, y: m.hypopneaRaw })))
		},
		{
			label: 'Central apnea events per minute',
			color: 'var(--chart-2)',
			dash: '6 3',
			step: true,
			points: withTail(minutes.map((m) => ({ x: m.t, y: m.centralRaw })))
		}
	]);
	const eventMax = $derived(Math.max(1, ...minutes.map((m) => Math.max(m.hypopneaRaw, m.centralRaw))));

	const spo2Series = $derived([
		{
			label: 'SpO₂ (raw value)',
			color: 'var(--chart-1)',
			points: minutes.filter((m) => m.spo2Raw > 0).map((m) => ({ x: m.t, y: m.spo2Raw }))
		}
	]);
	const pulseSeries = $derived([
		{
			label: 'Pulse (raw value)',
			color: 'var(--chart-2)',
			points: minutes.filter((m) => m.pulseRaw > 0).map((m) => ({ x: m.t, y: m.pulseRaw }))
		}
	]);

	const COUNTER_STYLES = [
		{ color: 'var(--chart-1)', dash: undefined },
		{ color: 'var(--chart-2)', dash: '6 3' },
		{ color: 'var(--chart-3)', dash: '2 3' },
		{ color: 'var(--chart-4)', dash: '8 3 2 3' }
	];
	const shownCounters = $derived([...(summary?.counters ?? [])].sort((a, b) => b.total - a.total).slice(0, 4));
	const hiddenCounters = $derived(Math.max(0, (summary?.counters.length ?? 0) - shownCounters.length));
	const counterSeries = $derived(
		shownCounters.map((c, i) => {
			const def = COUNTER_DEFS.find((d) => d.key === c.key)!;
			return {
				label: `${c.label} (total ${c.total})`,
				color: COUNTER_STYLES[i].color,
				dash: COUNTER_STYLES[i].dash,
				step: true,
				points: withTail(minutes.map((m) => ({ x: m.t, y: def.pick(m) })))
			};
		})
	);
	const counterMax = $derived(Math.max(1, ...counterSeries.flatMap((s) => s.points.map((p) => p.y))));
	const currentCounters = $derived(
		current ? COUNTER_DEFS.map((d) => ({ label: d.label, v: d.pick(current) })).filter((c) => c.v > 0) : []
	);
	const waveSeries = $derived(
		current
			? [
					{
						label: 'Flow channel 1',
						color: 'var(--chart-1)',
						points: current.flow1.map((v, i) => ({ x: i / 10, y: v }))
					},
					{
						label: 'Flow channel 2',
						color: 'var(--chart-2)',
						dash: '6 3',
						points: current.flow2.map((v, i) => ({ x: i / 10, y: v }))
					}
				]
			: []
	);

	function onloaded(incoming: Session[], newWarnings: string[]) {
		const byId = new Map(sessions.map((s) => [s.meta.sessionId, s]));
		for (const s of incoming) byId.set(s.meta.sessionId, s);
		sessions = [...byId.values()].sort((a, b) => a.meta.start - b.meta.start);
		warnings = newWarnings;
		if (incoming.length) {
			selectedId = incoming[0].meta.sessionId;
			minuteIndex = 0;
		}
	}

	function selectSession(id: string) {
		selectedId = id;
		minuteIndex = 0;
	}

	function selectMinuteAt(x: number) {
		const i = nearestIndex(minuteTimes, x);
		if (i >= 0) minuteIndex = i;
	}

	const fmt1 = (v: number) => v.toFixed(1);
</script>

<svelte:head>
	<title>Therapy data viewer | djmed</title>
</svelte:head>

<h1>Therapy data viewer</h1>
<p class="lede">
	Load the per-minute JSONL exports from a Yuwell BreathCare device to see pressure, leakage, respiratory
	events, SpO₂ and pulse (when present) and the flow waveform for each session.
</p>

{#if !session}
	<FileLoader {onloaded} />
	{#if warnings.length}
		<ul class="warnings" role="alert">
			{#each warnings as w (w)}<li>{w}</li>{/each}
		</ul>
	{/if}
{:else if summary && current}
	<FileLoader {onloaded} compact />
	{#if warnings.length}
		<ul class="warnings" role="alert">
			{#each warnings as w (w)}<li>{w}</li>{/each}
		</ul>
	{/if}

	<div class="tabs" role="group" aria-label="Sessions">
		{#each sessions as s (s.meta.sessionId)}
			<button
				type="button"
				aria-pressed={s.meta.sessionId === session.meta.sessionId}
				onclick={() => selectSession(s.meta.sessionId)}
			>
				Session {s.meta.sessionId}
				<small>{formatDateTime(s.meta.start)}</small>
			</button>
		{/each}
	</div>

	<p class="device">
		{session.meta.deviceFamily}
		{session.meta.deviceModel}
		{#if session.meta.deviceSerial}· serial {session.meta.deviceSerial}{/if}
		· {formatDateTime(session.meta.start)} to {formatDateTime(session.meta.end)}
	</p>

	<dl class="stats">
		<StatCard label="Duration" value={formatDuration(summary.durationMin)} hint="{summary.records} minute records" />
		<StatCard
			label="Pressure (mean)"
			value="{fmt1(summary.pressure.mean)} cmH₂O"
			hint="min {fmt1(summary.pressure.min)} · 95th pct {fmt1(summary.pressure.p95)} · max {fmt1(summary.pressure.max)}"
		/>
		<StatCard
			label="Leakage (mean)"
			value={summary.leakage.mean.toFixed(2)}
			hint="max {fmt1(summary.leakage.max)} · {summary.leakage.minutesAbove0} min above 0"
		/>
		<StatCard
			label="Hypopnea events"
			value={String(summary.hypopnea.total)}
			hint="{summary.hypopnea.minutes} minute(s) with events · central apnea: {summary.central.total}"
		/>
		<StatCard
			label="SpO₂ and pulse"
			value={hasOximetry ? 'Recorded' : 'No data'}
			hint={hasOximetry
				? `SpO₂ raw ${summary.spo2.min}–${summary.spo2.max} · pulse raw ${summary.pulse.min}–${summary.pulse.max}`
				: '0 in every minute of this file'}
		/>
	</dl>

	<section aria-labelledby="notes-h" class="card">
		<h2 id="notes-h">About this data</h2>
		<ul class="notes">
			{#each notes as n (n.title)}
				<li class={n.level}>
					<span class="badge">{n.level === 'warning' ? 'Check' : 'Note'}</span>
					<div><strong>{n.title}.</strong> {n.detail}</div>
				</li>
			{/each}
		</ul>
		{#if summary.headerChecks.length}
			<h3>Header cross-check</h3>
			<p class="hint">Totals recomputed from the minute records, compared with numbers stored in the session header.</p>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Check</th>
							<th scope="col">Header</th>
							<th scope="col">Records</th>
							<th scope="col">Result</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.headerChecks as c (c.label)}
							<tr>
								<th scope="row">{c.label}</th>
								<td>{c.expected}</td>
								<td>{c.actual}</td>
								<td>{c.ok ? 'Matches' : 'Differs'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section aria-labelledby="pressure-h" class="card">
		<h2 id="pressure-h">Pressure over the session</h2>
		<p class="hint">Click a chart to inspect that minute's flow waveform below.</p>
		<LineChart
			series={pressureSeries}
			{xDomain}
			height={240}
			formatY={fmt1}
			cursor={current.t}
			markers={pressureMarkers}
			markerLabel="Minute with hypopnea"
			onselect={selectMinuteAt}
			ariaLabel="Line chart of pressure in cmH2O for each minute of session {session.meta.sessionId}, from {fmt1(summary.pressure.min)} to {fmt1(summary.pressure.max)}"
		/>
	</section>

	<section aria-labelledby="leak-h" class="card">
		<h2 id="leak-h">Leakage</h2>
		<LineChart
			series={leakSeries}
			{xDomain}
			yDomain={[0, Math.max(1, Math.ceil(summary.leakage.max))]}
			height={180}
			formatY={fmt1}
			cursor={current.t}
			onselect={selectMinuteAt}
			ariaLabel="Line chart of leakage for each minute of session {session.meta.sessionId}, maximum {fmt1(summary.leakage.max)}"
		/>
	</section>

	<section aria-labelledby="events-h" class="card">
		<h2 id="events-h">Respiratory events per minute</h2>
		<p class="hint">
			Hypopnea and central apnea counts. Obstructive apnea is not shown because that field in the export just repeats the pressure value.
		</p>
		<LineChart
			series={eventSeries}
			{xDomain}
			yDomain={[0, eventMax]}
			integerY
			height={180}
			markers={eventMarkers}
			markerLabel="Minute with hypopnea"
			cursor={current.t}
			onselect={selectMinuteAt}
			ariaLabel="Chart of hypopnea and central apnea events per minute for session {session.meta.sessionId}: {summary.hypopnea.total} hypopnea events in {summary.hypopnea.minutes} minutes and {summary.central.total} central apnea events"
		/>
	</section>

	<section aria-labelledby="oxi-h" class="card">
		<h2 id="oxi-h">SpO₂ and pulse</h2>
		{#if hasOximetry}
			<p class="hint">Raw values; the scale has not been established. Minutes recorded as 0 are left out.</p>
			<LineChart
				series={spo2Series}
				{xDomain}
				height={180}
				cursor={current.t}
				onselect={selectMinuteAt}
				ariaLabel="Line chart of raw SpO2 readings for session {session.meta.sessionId}"
			/>
			<LineChart
				series={pulseSeries}
				{xDomain}
				height={180}
				cursor={current.t}
				onselect={selectMinuteAt}
				ariaLabel="Line chart of raw pulse readings for session {session.meta.sessionId}"
			/>
		{:else}
			<p class="empty">
				No SpO₂ or pulse readings in this session: both fields are 0 in all {summary.records} minutes. If your device
				records them, they are not being decoded into this export. Load a file where they are non-zero and the charts
				appear here.
			</p>
		{/if}
	</section>

	{#if counterSeries.length}
		<section aria-labelledby="counters-h" class="card">
			<h2 id="counters-h">Unlabeled event counters</h2>
			<p class="hint">
				Count-like bytes in each record whose purpose is not established. Byte 8 and byte 10 totals match numbers stored in the
				session header, so they are probably event counts. Compare with your device's own report to identify them.
				{#if hiddenCounters > 0}{hiddenCounters} smaller counter(s) are not shown.{/if}
			</p>
			<LineChart
				series={counterSeries}
				{xDomain}
				yDomain={[0, counterMax]}
				integerY
				height={200}
				cursor={current.t}
				onselect={selectMinuteAt}
				ariaLabel="Chart of unlabeled counter bytes per minute for session {session.meta.sessionId}"
			/>
		</section>
	{/if}

	<section aria-labelledby="amp-h" class="card">
		<h2 id="amp-h">Flow signal size per minute</h2>
		<p class="hint">Peak-to-peak range of each flow channel in raw units. Larger values mean bigger breaths or movement in the signal.</p>
		<LineChart
			series={flowAmpSeries}
			{xDomain}
			height={200}
			cursor={current.t}
			onselect={selectMinuteAt}
			ariaLabel="Line chart of the peak-to-peak flow signal for each minute of session {session.meta.sessionId}"
		/>
	</section>

	<section aria-labelledby="wave-h" class="card">
		<h2 id="wave-h">Flow waveform, {formatClock(current.t)}</h2>
		<div class="picker">
			<button type="button" onclick={() => (minuteIndex = Math.max(0, safeIndex - 1))} disabled={safeIndex === 0}>
				Previous minute
			</button>
			<label>
				<span class="sr">Minute of the session</span>
				<input type="range" min="0" max={minutes.length - 1} step="1" bind:value={minuteIndex} />
			</label>
			<button
				type="button"
				onclick={() => (minuteIndex = Math.min(minutes.length - 1, safeIndex + 1))}
				disabled={safeIndex === minutes.length - 1}
			>
				Next minute
			</button>
		</div>
		<LineChart
			series={waveSeries}
			xDomain={[0, 60]}
			xKind="number"
			height={240}
			formatX={(v) => `${v}s`}
			ariaLabel="Flow waveform for both channels during the minute starting {formatClock(current.t)}, 10 samples per second"
		/>
		<dl class="facts">
			<div><dt>Pressure</dt><dd>{fmt1(current.pressure)} cmH₂O</dd></div>
			<div><dt>Leakage</dt><dd>{current.leakage.toFixed(1)}</dd></div>
			<div><dt>Hypopnea events</dt><dd>{current.hypopneaRaw}</dd></div>
			<div>
				<dt>Unlabeled counters</dt>
				<dd>{currentCounters.length ? currentCounters.map((c) => `${c.label}: ${c.v}`).join(', ') : 'all 0'}</dd>
			</div>
		</dl>
	</section>

	{#if sessions.length > 1}
		<section aria-labelledby="cmp-h" class="card">
			<h2 id="cmp-h">Compare sessions</h2>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Session</th>
							<th scope="col">Start</th>
							<th scope="col">Duration</th>
							<th scope="col">Pressure mean / 95th / max</th>
							<th scope="col">Leakage mean / max</th>
							<th scope="col">Hypopnea events</th>
						</tr>
					</thead>
					<tbody>
						{#each sessions as s (s.meta.sessionId)}
							{@const sm = summarize(s)}
							<tr class:current={s.meta.sessionId === session.meta.sessionId}>
								<th scope="row">{s.meta.sessionId}</th>
								<td>{formatDateTime(s.meta.start)}</td>
								<td>{formatDuration(sm.durationMin)}</td>
								<td>{fmt1(sm.pressure.mean)} / {fmt1(sm.pressure.p95)} / {fmt1(sm.pressure.max)}</td>
								<td>{sm.leakage.mean.toFixed(2)} / {fmt1(sm.leakage.max)}</td>
								<td>{sm.hypopnea.total} in {sm.hypopnea.minutes} min</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
{/if}

<style>
	h1 {
		margin: 0 0 0.25rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.125rem;
	}
	h3 {
		margin: 1rem 0 0.25rem;
		font-size: 1rem;
	}
	.lede,
	.device,
	.hint,
	.empty {
		color: var(--color-muted);
	}
	.empty {
		margin: 0;
	}
	.lede {
		margin: 0 0 1.5rem;
	}
	.hint {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
	}
	.device {
		margin: 0.75rem 0 1rem;
		font-size: 0.875rem;
	}
	.warnings {
		margin: 0.75rem 0;
		padding: 0.5rem 1rem 0.5rem 1.5rem;
		border: 1px solid var(--chart-flag);
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.tabs button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--color-fg);
		font: inherit;
		cursor: pointer;
	}
	.tabs button[aria-pressed='true'] {
		border-color: var(--color-accent);
		box-shadow: inset 0 0 0 1px var(--color-accent);
		font-weight: 600;
	}
	.tabs small {
		color: var(--color-muted);
		font-weight: 400;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.75rem;
		margin: 0 0 1rem;
	}
	.card {
		margin: 0 0 1rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
	}
	.notes {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}
	.notes li {
		display: flex;
		gap: 0.625rem;
		align-items: flex-start;
	}
	.badge {
		flex: none;
		min-width: 3.25rem;
		padding: 0.0625rem 0.375rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-align: center;
	}
	.warning .badge {
		border-color: var(--chart-flag);
		color: var(--chart-flag);
	}
	.picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}
	.picker label {
		flex: 1 1 12rem;
	}
	.picker input[type='range'] {
		width: 100%;
	}
	.picker button {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--color-fg);
		font: inherit;
		cursor: pointer;
	}
	.picker button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 2rem;
		margin: 0.75rem 0 0;
	}
	.facts dt {
		font-size: 0.75rem;
		color: var(--color-muted);
	}
	.facts dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	th,
	td {
		padding: 0.375rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		white-space: nowrap;
	}
	tr.current {
		background: var(--color-surface);
	}
</style>
