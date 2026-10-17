<script lang="ts">
	import { base } from '$app/paths';
	import { parseJsonl } from '$lib/data/parse';
	import type { Session } from '$lib/data/types';

	let {
		onloaded,
		compact = false
	}: {
		onloaded: (sessions: Session[], warnings: string[]) => void;
		compact?: boolean;
	} = $props();

	const SAMPLES = ['0100001.jsonl', '0100002.jsonl', '0100024.jsonl', '0100025.jsonl'];

	let busy = $state(false);
	let dragging = $state(false);
	let error = $state('');

	async function ingest(items: { name: string; text: () => Promise<string> }[]) {
		busy = true;
		error = '';
		try {
			const sessions: Session[] = [];
			const warnings: string[] = [];
			for (const item of items) {
				const result = parseJsonl(await item.text(), item.name);
				sessions.push(...result.sessions);
				warnings.push(...result.warnings);
				if (!result.sessions.length) warnings.push(`${item.name}: no sessions were found in this file.`);
			}
			onloaded(sessions, warnings);
		} catch (e) {
			error = e instanceof Error ? e.message : 'The files could not be read.';
		} finally {
			busy = false;
		}
	}

	function onFiles(files: FileList | null) {
		if (files?.length) ingest([...files].map((f) => ({ name: f.name, text: () => f.text() })));
	}

	function loadSamples() {
		ingest(
			SAMPLES.map((name) => ({
				name,
				text: async () => {
					const res = await fetch(`${base}/samples/${name}`);
					if (!res.ok) throw new Error(`Could not load sample ${name} (${res.status}).`);
					return res.text();
				}
			}))
		);
	}
</script>

<div class="loader" class:compact>
	<label
		class="drop"
		class:dragging
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			onFiles(e.dataTransfer?.files ?? null);
		}}
	>
		<input
			type="file"
			multiple
			accept=".jsonl,.ndjson,.json,application/x-ndjson,application/json"
			onchange={(e) => {
				onFiles(e.currentTarget.files);
				e.currentTarget.value = '';
			}}
		/>
		<span class="title">{compact ? 'Add more session files' : 'Drop .jsonl session files here, or click to choose'}</span>
		{#if !compact}<span class="sub">Files are read in your browser and never uploaded.</span>{/if}
	</label>
	<button type="button" onclick={loadSamples} disabled={busy}>
		{busy ? 'Loading…' : 'Load sample data'}
	</button>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	.loader {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 0.75rem;
	}
	.drop {
		flex: 1 1 18rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		padding: 2rem 1rem;
		border: 2px dashed var(--color-border);
		border-radius: 0.5rem;
		text-align: center;
		cursor: pointer;
	}
	.compact .drop {
		padding: 0.625rem 1rem;
	}
	.drop.dragging,
	.drop:hover,
	.drop:focus-within {
		border-color: var(--color-accent);
	}
	.drop:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}
	.title {
		font-weight: 600;
	}
	.sub {
		font-size: 0.8125rem;
		color: var(--color-muted);
	}
	button {
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-accent);
		border-radius: 0.5rem;
		background: var(--color-accent);
		color: var(--color-on-accent);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.error {
		flex-basis: 100%;
		margin: 0;
		color: var(--chart-flag);
	}
</style>
