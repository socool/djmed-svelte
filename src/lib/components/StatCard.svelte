<script lang="ts">
	let { label, value, hint = '' }: { label: string; value: string; hint?: string } = $props();
</script>

<div class="stat">
	<dt>{label}</dt>
	<dd>{value}</dd>
	{#if hint}<p>{hint}</p>{/if}
</div>

<style>
	.stat {
		padding: 0.75rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-surface);
	}
	dt {
		font-size: 0.75rem;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	dd {
		margin: 0.125rem 0 0;
		font-size: 1.5rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	p {
		margin: 0.125rem 0 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}
</style>
