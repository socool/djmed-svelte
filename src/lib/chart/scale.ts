/** Round-number tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
	if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
	if (min === max) return [min];
	const raw = (max - min) / Math.max(1, count);
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const norm = raw / mag;
	const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
	const out: number[] = [];
	for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
		out.push(Number(v.toFixed(10)));
	}
	return out;
}

const TIME_STEPS_MIN = [1, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];

/** Clock-aligned ticks (UTC) for an epoch-ms range. */
export function timeTicks(minMs: number, maxMs: number, maxCount = 7): number[] {
	if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) return [];
	const spanMin = (maxMs - minMs) / 60_000;
	const stepMin = TIME_STEPS_MIN.find((s) => spanMin / s <= maxCount) ?? 1440;
	const step = stepMin * 60_000;
	const out: number[] = [];
	for (let t = Math.ceil(minMs / step) * step; t <= maxMs; t += step) out.push(t);
	return out;
}

/** "HH:MM" from epoch-ms where the device clock was read as UTC. */
export function formatClock(ms: number): string {
	const d = new Date(ms);
	return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** "6 Oct, 22:12" */
export function formatDateTime(ms: number): string {
	const d = new Date(ms);
	const month = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
	return `${d.getUTCDate()} ${month}, ${formatClock(ms)}`;
}

export function formatDuration(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return h ? `${h} h ${m} min` : `${m} min`;
}

/** Index of the point whose x is closest to `x`. `xs` must be sorted ascending. */
export function nearestIndex(xs: number[], x: number): number {
	if (!xs.length) return -1;
	let lo = 0;
	let hi = xs.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (xs[mid] < x) lo = mid;
		else hi = mid;
	}
	return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}
