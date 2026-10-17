/** Session-level metadata (the `session` record). */
export interface SessionMeta {
	sessionId: string;
	deviceFamily: string;
	deviceModel: string;
	deviceSerial: string;
	/** Session start, as ms since epoch, with the device's local clock read as UTC. */
	start: number;
	end: number;
	/** `unknown_summary_bytes_hex` decoded as little-endian uint16 words (meaning mostly not established). */
	summaryWords: number[];
}

/** One `minute_summary` record. Raw values are kept; scaled values are derived. */
export interface MinuteRecord {
	/** ms since epoch, device-local clock read as UTC (use the UTC getters to display). */
	t: number;
	timestamp: string;
	pressureRaw: number;
	/** cmH2O (raw / 10). */
	pressure: number;
	leakageRaw: number;
	/** raw / 10, unit not established. */
	leakage: number;
	/** Equals pressureRaw in every sample file, so it is not treated as an event count. */
	obstructiveRaw: number;
	centralRaw: number;
	hypopneaRaw: number;
	spo2Raw: number;
	pulseRaw: number;
	/** Bytes 5-8 of the record (`unknown_05_08_hex`), each a separate unlabeled counter. */
	unk05: number[];
	/** Bytes 10-14 of the record (`unknown_10_14_hex`). */
	unk10: number[];
	/** First byte of `unknown_18_21_hex`, varies minute to minute. */
	tailByte: number;
	/** 600 samples at 10 Hz (one minute). Raw unsigned bytes, scale not established. */
	flow1: number[];
	flow2: number[];
}

export interface Session {
	meta: SessionMeta;
	minutes: MinuteRecord[];
}

export interface ParseResult {
	sessions: Session[];
	/** Human-readable problems: bad JSON lines, orphan records, unknown record types. */
	warnings: string[];
}

export interface CounterInfo {
	/** Stable id, e.g. "b8". */
	key: string;
	label: string;
	total: number;
	/** Minutes in which the counter is non-zero. */
	minutes: number;
}

export interface HeaderCheck {
	label: string;
	expected: number;
	actual: number;
	ok: boolean;
}

export interface Summary {
	durationMin: number;
	records: number;
	pressure: { min: number; mean: number; median: number; p95: number; max: number };
	leakage: { mean: number; max: number; minutesAbove0: number };
	hypopnea: { total: number; minutes: number };
	central: { total: number; minutes: number };
	spo2: { minutes: number; min: number; max: number };
	pulse: { minutes: number; min: number; max: number };
	/** Unlabeled counter bytes that are non-zero somewhere in the session. */
	counters: CounterInfo[];
	headerChecks: HeaderCheck[];
	flowAmplitude: { flow1Mean: number; flow2Mean: number };
	timeGaps: number;
}

export interface QualityNote {
	level: 'warning' | 'info';
	title: string;
	detail: string;
}
