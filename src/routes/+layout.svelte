<script lang="ts">
	import '../app.css';
	import { Header, Footer } from '$lib';

	let { children } = $props();
</script>

<Header />

<main>
	{@render children()}
</main>

<Footer />

<style>
	main {
		max-width: var(--max-width);
		margin: 0 auto;
		padding: 2rem 1rem;
		min-height: 60vh;
	}
</style>
