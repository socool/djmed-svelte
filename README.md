# djmed-svelte

SvelteKit (Svelte 5 + TypeScript) skeleton.

## Getting started

```sh
npm install
cp .env.example .env
npm run dev
```

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start the dev server           |
| `npm run build`   | Production build               |
| `npm run preview` | Preview the production build   |
| `npm run check`   | Type-check with `svelte-check` |

## Structure

```
src/
  app.html           HTML shell
  app.css            Global styles and CSS variables
  app.d.ts           App-wide type declarations
  lib/               Shared code, importable as `$lib`
    components/      Reusable Svelte components
  routes/            File-based routes
static/              Files served as-is
```

## Deployment

`@sveltejs/adapter-auto` is configured by default. Swap it in `svelte.config.js` for the adapter matching your host (node, static, vercel, cloudflare, ...).
