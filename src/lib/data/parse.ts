import type { MinuteRecord, ParseResult, Session, SessionMeta } from './types';

/**
 * Timestamps such as "2026-10-06T22:12:00" carry no timezone. They are the device's
 * local clock, so they are read as UTC to keep the displayed time identical on every machine.
 */
export function parseClock(ts: string): number {
	const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(ts);
	if (!m) return NaN;
	return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function hexToBytes(hex: unknown): number[] {
	if (typeof hex !== 'string' || hex.length % 2 !== 0) return [];
	const out: number[] = [];
	for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
	return out;
}

function words16le(bytes: number[]): number[] {
	const out: number[] = [];
	for (let i = 0; i + 1 < bytes.length; i += 2) out.push(bytes[i] | (bytes[i + 1] << 8));
	return out;
}

function num(v: unknown): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function numArray(v: unknown): number[] {
	return Array.isArray(v) ? v.map(num) : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

function toMeta(r: Raw): SessionMeta {
	return {
		sessionId: String(r.session_id ?? ''),
		deviceFamily: String(r.device_family ?? ''),
		deviceModel: String(r.device_model ?? ''),
		deviceSerial: String(r.device_serial ?? ''),
		start: parseClock(String(r.start ?? '')),
		end: parseClock(String(r.end ?? '')),
		summaryWords: words16le(hexToBytes(r.format_notes?.unknown_summary_bytes_hex))
	};
}

function toMinute(r: Raw): MinuteRecord | null {
	const t = parseClock(String(r.timestamp ?? ''));
	if (Number.isNaN(t)) return null;
	const b05 = hexToBytes(r.unknown_05_08_hex);
	const b10 = hexToBytes(r.unknown_10_14_hex);
	const b18 = hexToBytes(r.unknown_18_21_hex);
	const pressureRaw = num(r.pressure_raw);
	const leakageRaw = num(r.leakage_raw);
	return {
		t,
		timestamp: String(r.timestamp),
		pressureRaw,
		pressure: pressureRaw / 10,
		leakageRaw,
		leakage: leakageRaw / 10,
		obstructiveRaw: num(r.obstructive_apnea_events),
		centralRaw: num(r.central_apnea_events),
		hypopneaRaw: num(r.hypopnea_events),
		spo2Raw: num(r.spo2_raw),
		pulseRaw: num(r.pulse_raw),
		unk05: [0, 1, 2, 3].map((i) => b05[i] ?? 0),
		unk10: [0, 1, 2, 3, 4].map((i) => b10[i] ?? 0),
		tailByte: b18[0] ?? 0,
		flow1: numArray(r.flow?.channel_1_raw),
		flow2: numArray(r.flow?.channel_2_raw)
	};
}

/**
 * Parse one or more JSONL files' text. Records belong to the session named by their
 * `session_id`; a file may contain several sessions.
 */
export function parseJsonl(text: string, fileName = 'file'): ParseResult {
	const warnings: string[] = [];
	const metas = new Map<string, SessionMeta>();
	const minutes = new Map<string, MinuteRecord[]>();
	const unknownTypes = new Set<string>();

	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		let rec: Raw;
		try {
			rec = JSON.parse(line);
		} catch {
			warnings.push(`${fileName}: line ${i + 1} is not valid JSON and was skipped.`);
			continue;
		}
		if (rec.record_type === 'session') {
			const meta = toMeta(rec);
			metas.set(meta.sessionId, meta);
			if (!minutes.has(meta.sessionId)) minutes.set(meta.sessionId, []);
		} else if (rec.record_type === 'minute_summary') {
			const m = toMinute(rec);
			const id = String(rec.session_id ?? '');
			if (!m) {
				warnings.push(`${fileName}: line ${i + 1} has an unreadable timestamp and was skipped.`);
				continue;
			}
			if (!minutes.has(id)) minutes.set(id, []);
			minutes.get(id)!.push(m);
		} else {
			unknownTypes.add(String(rec.record_type));
		}
	}

	if (unknownTypes.size) {
		warnings.push(`${fileName}: ignored record types: ${[...unknownTypes].join(', ')}.`);
	}

	const sessions: Session[] = [];
	for (const [id, list] of minutes) {
		list.sort((a, b) => a.t - b.t);
		let meta = metas.get(id);
		if (!meta) {
			if (!list.length) continue;
			warnings.push(`${fileName}: no session header for ${id}; times were taken from the records.`);
			meta = {
				sessionId: id,
				deviceFamily: '',
				deviceModel: '',
				deviceSerial: '',
				start: list[0].t,
				end: list[list.length - 1].t + 60_000,
				summaryWords: []
			};
		}
		sessions.push({ meta, minutes: list });
	}
	sessions.sort((a, b) => a.meta.start - b.meta.start);
	return { sessions, warnings };
}
