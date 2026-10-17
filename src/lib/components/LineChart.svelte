<script lang="ts">
	import { niceTicks, timeTicks, formatClock, nearestIndex } from '$lib/chart/scale';

	interface Point {
		x: number;
		y: number;
	}
	interface Series {
		label: string;
		/** Any CSS color, e.g. "var(--chart-1)". */
		color: string;
		points: Point[];
		/** Draw as a step line (value holds until the next point). */
		step?: boolean;
		/** SVG stroke-dasharray, used so series differ by more than color. */
		dash?: string;
	}
	interface Marker {
		x: number;
		y: number;
		label: string;
	}

	let {
		series,
		xDomain,
		yDomain,
		height = 220,
		xKind = 'time',
		ariaLabel,
		formatX = formatClock,
		formatY = (v: number) => String(v),
		integerY = false,
		cursor = null,
		markers = [],
		markerLabel = '',
		onselect
	}: {
		series: Series[];
		xDomain?: [number, number];
		yDomain?: [number, number];
		height?: number;
		xKind?: 'time' | 'number';
		ariaLabel: string;
		formatX?: (v: number) => string;
		formatY?: (v: number) => string;
		/** Counts: y axis ticks are whole numbers only. */
		integerY?: boolean;
		cursor?: number | null;
		markers?: Marker[];
		markerLabel?: string;
		onselect?: (x: number) => void;
	} = $props();

	const m = { top: 12, right: 14, bottom: 28, left: 46 };

	let width = $state(640);
	let hoverX = $state<number | null>(null);

	const innerW = $derived(Math.max(10, width - m.left - m.right));
	const innerH = $derived(Math.max(10, height - m.top - m.bottom));

	const extent = $derived.by(() => {
		let xLo = Infinity;
		let xHi = -Infinity;
		let yLo = Infinity;
		let yHi = -Infinity;
		for (const s of series) {
			for (const p of s.points) {
				if (p.x < xLo) xLo = p.x;
				if (p.x > xHi) xHi = p.x;
				if (p.y < yLo) yLo = p.y;
				if (p.y > yHi) yHi = p.y;
			}
		}
		return { xLo, xHi, yLo, yHi };
	});

	const hasData = $derived(Number.isFinite(extent.xLo));
	const x0 = $derived(xDomain ? xDomain[0] : extent.xLo);
	const x1 = $derived(xDomain ? xDomain[1] : extent.xHi);

	const yScale = $derived.by(() => {
		let lo = yDomain ? yDomain[0] : extent.yLo;
		let hi = yDomain ? yDomain[1] : extent.yHi;
		if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1, ticks: [0, 1] };
		if (integerY) {
			lo = Math.floor(lo);
			hi = Math.max(Math.ceil(hi), lo + 1);
			const span = hi - lo;
			const ticks = span <= 6 ? Array.from({ length: span + 1 }, (_, i) => lo + i) : niceTicks(lo, hi, 4).filter(Number.isInteger);
			return { lo, hi, ticks };
		}
		if (!yDomain) {
			if (lo === hi) {
				lo -= 1;
				hi += 1;
			}
			const rough = niceTicks(lo, hi, 4);
			if (rough.length > 1) {
				const step = rough[1] - rough[0];
				lo = Math.floor(lo / step) * step;
				hi = Math.ceil(hi / step) * step;
			}
		}
		return { lo, hi, ticks: niceTicks(lo, hi, 4) };
	});

	const xTicks = $derived(
		xKind === 'time'
			? timeTicks(x0, x1, Math.max(3, Math.floor(innerW / 80)))
			: niceTicks(x0, x1, Math.max(3, Math.floor(innerW / 70)))
	);

	function sx(x: number): number {
		return m.left + (x1 === x0 ? 0 : ((x - x0) / (x1 - x0)) * innerW);
	}
	function sy(y: number): number {
		const { lo, hi } = yScale;
		return m.top + innerH - (hi === lo ? 0 : ((y - lo) / (hi - lo)) * innerH);
	}
	const f = (n: number) => n.toFixed(1);

	function pathFor(s: Series): string {
		const pts = s.points;
		if (!pts.length) return '';
		let d = `M${f(sx(pts[0].x))},${f(sy(pts[0].y))}`;
		for (let i = 1; i < pts.length; i++) {
			const p = pts[i];
			d += s.step ? `H${f(sx(p.x))}V${f(sy(p.y))}` : `L${f(sx(p.x))},${f(sy(p.y))}`;
		}
		return d;
	}

	function dataXFromEvent(e: MouseEvent): number {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		return x0 + frac * (x1 - x0);
	}

	const hover = $derived.by(() => {
		if (hoverX === null || !series.length) return null;
		let snapped = hoverX;
		const items: { label: string; color: string; y: number }[] = [];
		series.forEach((s, k) => {
			const i = nearestIndex(
				s.points.map((p) => p.x),
				hoverX!
			);
			if (i < 0) return;
			if (k === 0) snapped = s.points[i].x;
			items.push({ label: s.label, color: s.color, y: s.points[i].y });
		});
		return { x: snapped, items };
	});
</script>

<div class="chart">
	<ul class="legend" aria-hidden="true">
		{#each series as s (s.label)}
			<li>
				<svg width="26" height="10" viewBox="0 0 26 10">
					<line
						x1="1"
						y1="5"
						x2="25"
						y2="5"
						stroke-width="2.5"
						stroke-dasharray={s.dash}
						style="stroke: {s.color}"
					/>
				</svg>
				{s.label}
			</li>
		{/each}
		{#if markers.length && markerLabel}
			<li>
				<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" class="marker" /></svg>
				{markerLabel}
			</li>
		{/if}
	</ul>

	<div class="plot" bind:clientWidth={width}>
		{#if !hasData}
			<p class="empty">No data to plot.</p>
		{:else}
			<svg {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={ariaLabel}>
				{#each yScale.ticks as t (t)}
					<line class="grid" x1={m.left} x2={m.left + innerW} y1={sy(t)} y2={sy(t)} />
					<text class="tick" x={m.left - 8} y={sy(t)} text-anchor="end" dominant-baseline="middle">
						{formatY(t)}
					</text>
				{/each}
				{#each xTicks as t (t)}
					<line class="axis" x1={sx(t)} x2={sx(t)} y1={m.top + innerH} y2={m.top + innerH + 4} />
					<text class="tick" x={sx(t)} y={m.top + innerH + 18} text-anchor="middle">{formatX(t)}</text>
				{/each}
				<line class="axis" x1={m.left} x2={m.left + innerW} y1={m.top + innerH} y2={m.top + innerH} />

				{#each series as s (s.label)}
					<path d={pathFor(s)} fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray={s.dash} style="stroke: {s.color}" />
				{/each}

				{#each markers as mk (mk.x)}
					<circle class="marker" cx={sx(mk.x)} cy={sy(mk.y)} r="4.5"><title>{mk.label}</title></circle>
				{/each}

				{#if cursor !== null && cursor >= x0 && cursor <= x1}
					<line class="cursor" x1={sx(cursor)} x2={sx(cursor)} y1={m.top} y2={m.top + innerH} />
				{/if}
				{#if hover}
					<line class="hover" x1={sx(hover.x)} x2={sx(hover.x)} y1={m.top} y2={m.top + innerH} />
					{#each hover.items as it (it.label)}
						<circle cx={sx(hover.x)} cy={sy(it.y)} r="3.5" style="fill: {it.color}" />
					{/each}
				{/if}

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<rect
					x={m.left}
					y={m.top}
					width={innerW}
					height={innerH}
					fill="transparent"
					style="touch-action: pan-y; cursor: {onselect ? 'pointer' : 'default'}"
					onpointermove={(e) => (hoverX = dataXFromEvent(e))}
					onpointerleave={() => (hoverX = null)}
					onclick={(e) => {
						if (!onselect) return;
						const x = dataXFromEvent(e);
						const xs = series[0]?.points.map((p) => p.x) ?? [];
						const i = nearestIndex(xs, x);
						if (i >= 0) onselect(xs[i]);
					}}
				/>
			</svg>

			{#if hover}
				<div class="tip" class:flip={sx(hover.x) > width * 0.6} style="left: {sx(hover.x)}px; top: {m.top}px">
					<strong>{formatX(hover.x)}</strong>
					{#each hover.items as it (it.label)}
						<div><span class="sw" style="background: {it.color}"></span>{it.label}: {formatY(it.y)}</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.chart {
		width: 100%;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		margin: 0 0 0.25rem;
		padding: 0;
		list-style: none;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.plot {
		position: relative;
		width: 100%;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--chart-grid);
		stroke-width: 1;
	}
	.axis {
		stroke: var(--chart-axis);
		stroke-width: 1;
	}
	.tick {
		fill: var(--chart-axis);
		font-size: 11px;
	}
	.cursor {
		stroke: var(--color-fg);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.hover {
		stroke: var(--chart-axis);
		stroke-width: 1;
	}
	.marker {
		fill: var(--chart-flag);
		stroke: var(--color-bg);
		stroke-width: 1.5;
	}
	.tip {
		position: absolute;
		z-index: 2;
		transform: translateX(12px);
		pointer-events: none;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		background: var(--color-surface);
		color: var(--color-fg);
		font-size: 0.75rem;
		line-height: 1.4;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
	}
	.tip.flip {
		transform: translateX(calc(-100% - 12px));
	}
	.sw {
		display: inline-block;
		width: 0.625rem;
		height: 0.625rem;
		margin-right: 0.375rem;
		border-radius: 2px;
	}
	.empty {
		margin: 0;
		padding: 2rem 0;
		text-align: center;
		color: var(--color-muted);
	}
</style>
