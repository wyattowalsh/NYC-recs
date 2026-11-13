# Wyatt’s NYC Recs

A mobile-friendly guide to 60 NYC recommendations, with synchronized map and list views, search, area/type/vibe filters, shareable state, venue links, and optional local distance labels.

Public site: [nyc-recs.w4w.dev](https://nyc-recs.w4w.dev)

The client is a static React and TypeScript application built with Vite and Tailwind CSS. Leaflet and its stylesheet are bundled with the app; map tiles come from the attributed OpenStreetMap service. UI primitives are maintained locally under `src/components/ui`.

## Authoritative source

The React source in this repository is the maintained source of truth. It was recovered byte-for-byte from Vercel production deployment `dpl_42hK36EY8QgRr5U3Msg65L1mMTgS` before the November 2026 repair pass, then validated against the deployment’s original file hashes. The obsolete vanilla JavaScript implementation remains available through Git history rather than as a second runtime path.

## Local development

Use a Node.js release supported by the locked Vite version, then install exactly the committed dependency graph:

```bash
npm run install:locked
npm run dev
```

Vite prints the local URL. A specific free port can be requested with `npm run dev -- --port 4173`.

The repository stores the exact npm lock snapshot as a checksum-verified Brotli snapshot split into reviewable Base64 parts. `npm run install:locked` restores `package-lock.json` and runs `npm ci`. After intentionally changing dependencies, run `npm run lock:freeze` and commit the updated `.locks/` files.

The required release gate is:

```bash
npm run verify
```

`verify` runs the focused Node test suite, TypeScript checking through the production build, and the Vite bundle. The component commands remain available when diagnosing a failure:

```bash
npm test
npm run typecheck
npm run build
```

Preview the exact generated bundle with:

```bash
npm run preview -- --port 4173
```

## Source layout

| Path | Purpose |
| --- | --- |
| `src/data/recs/*.json` | Recommendation content, navigation targets, venue links, coordinates, and optional editorial metadata |
| `src/App.tsx` | Application state, filtering controls, sharing, geolocation feedback, and responsive views |
| `src/components/GuideMap.tsx` | Leaflet map, marker and popup lifecycle, and keyboard activation |
| `src/components/ui/` | Local shadcn/Radix primitives and their license |
| `src/lib/guide.ts` | Raw-content validation, filtering, URL serialization, labels, copy text, and distance helpers |
| `src/lib/urlState.ts` | Cancellable, coalesced History API persistence |
| `src/lib/mapInteraction.ts` | Marker keyboard activation rules |
| `src/lib/*.test.ts` | Content, state, keyboard, URL, and map-geometry regression tests |
| `src/index.css` and `src/styles/` | Ordered Tailwind entrypoint and application style modules |
| `.locks/` | Checksum-pinned compressed npm lock snapshot stored as ordered Base64 parts and restored by `npm run install:locked` |
| `scripts/restore-lock.mjs` / `scripts/freeze-lock.mjs` | Restore and update the exact npm dependency graph without committing generated lock text |
| `scripts/generate-og.mjs` | Deterministically materializes the 1200×630 social sharing PNG without external image dependencies |
| `scripts/generate-notices.mjs` | Generates deduplicated third-party notices from the committed lockfile and installed package metadata |
| `vercel.json` | Deterministic install/build commands, security headers, and immutable hashed-asset caching |

## Recommendation contract

`prepareRecs` validates the raw JSON before any consumer uses it. Each record requires:

- A unique, non-empty `id`.
- A known `area` and `type`.
- Non-empty display and descriptive strings.
- A string-only `tags` array.
- A valid HTTPS Google Maps URL and HTTPS `siteLinks`.
- Finite latitude and longitude within geographic ranges.

Optional editorial fields:

- `places`: searchable names represented by a combined recommendation.
- `primaryPlace`: the venue represented by the record’s coordinates and Google Maps action. The UI labels that destination explicitly.
- `statusChecked`: `YYYY-MM-DD` review date for a closure/reference label.

Invalid records fail the test/build path with recommendation and field context. They are never silently dropped.

## Shared views and privacy

The guide owns five URL keys: `q`, `area`, `type`, `vibe`, and `pick`. Search and filters update immediately; address-bar persistence is coalesced and failure-contained. Back/Forward navigation cancels stale pending writes before restoring state.

The Share action serializes current application state directly, so it remains correct even while an address-bar update is pending. Geolocation is requested only after the user selects **Show distances**. Coordinates remain in component memory and are not written to the URL or recommendation data.

## Content editing

1. Edit `src/data/recs/*.json` without changing an existing stable `id` unless the destination itself is being replaced.
2. Keep the Google Maps URL, coordinates, and `primaryPlace` aligned.
3. Update `statusChecked` when re-verifying a closure/reference entry.
4. Run `npm run verify`.
5. Review the map and list at wide and narrow viewport sizes before release.

## Deployment

Vercel must use the committed configuration:

```text
Install: npm run install:locked
Build:   npm run verify
Output:  dist
```

Create a protected candidate from a clean checkout, verify that exact deployment, then promote the same deployment rather than rebuilding a different artifact. After promotion, confirm:

- The public domain resolves to the intended deployment.
- Search, filters, list/map selection, marker Enter/Space activation, sharing, and distance permission states still work.
- Hashed `/assets/*` responses use long-lived immutable caching.
- HTML remains revalidated and references existing hashed assets.

The previous production deployment should be recorded as a rollback candidate immediately before promotion and used only if the production smoke check fails.

## Third-party software

Runtime and build dependency notices are generated during development and production builds and published at `/third-party-notices.txt`. Copied UI-source terms are also retained beside the source in `src/components/ui/LICENSE.txt`.
