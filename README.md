# djmed-svelte

SvelteKit (Svelte 5 + TypeScript) skeleton.

The home page is a viewer for per-minute JSONL exports from a Yuwell BreathCare YH680-A device. Drop one or more `.jsonl` files on the page (they are parsed in the browser and never uploaded), or press **Load sample data** to use the four files in `static/samples/`.

It shows, per session: summary stats, pressure over time, leakage, hypopnea and central apnea events, SpO₂ and pulse (charts appear only when a file contains non-zero values), unlabeled counter bytes, flow signal size per minute, and a 10 Hz flow waveform for any selected minute. A header cross-check table compares totals from the minute records with numbers stored in the session header. An "About this data" panel flags oddities found in the file itself, e.g. `obstructive_apnea_events` being an exact copy of `pressure_raw`, and fields that are always 0.

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
| `npm run verify:data` | Check the parser/statistics against the sample files (Node 22+) |

## Structure

```
src/
  app.html           HTML shell
  app.css            Global styles and CSS variables
  app.d.ts           App-wide type declarations
  lib/               Shared code, importable as `$lib`
    data/            JSONL parsing, statistics and data-quality notes (plain TypeScript)
    chart/           Axis/tick helpers
    components/      LineChart, StatCard, FileLoader, Header, Footer
  routes/            File-based routes (the viewer is `routes/+page.svelte`)
static/
  samples/           Four sample session files (0100001, 0100002, 0100024, 0100025)
scripts/             verify-data.mjs
```

## Deployment

`@sveltejs/adapter-auto` is configured by default. Swap it in `svelte.config.js` for the adapter matching your host (node, static, vercel, cloudflare, ...).
