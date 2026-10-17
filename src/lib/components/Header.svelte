<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/about', label: 'About' }
	];
</script>

<header>
	<a class="brand" href="/">djmed</a>
	<nav>
		{#each links as link}
			<a href={link.href} aria-current={page.url.pathname === link.href ? 'page' : undefined}>
				{link.label}
			</a>
		{/each}
	</nav>
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: var(--max-width);
		margin: 0 auto;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.brand {
		font-weight: 700;
		text-decoration: none;
		color: var(--color-fg);
	}

	nav {
		display: flex;
		gap: 1rem;
	}

	nav a {
		text-decoration: none;
		color: var(--color-muted);
	}

	nav a[aria-current='page'] {
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
