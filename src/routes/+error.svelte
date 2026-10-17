<script lang="ts">
	import { page } from '$app/state';
</script>

<h1>{page.status}</h1>
<p>{page.error?.message}</p>
<a href="/">Back to home</a>
