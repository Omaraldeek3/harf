# Verification — 2026-09-30

Verified locally before delivery:

- `npm run typecheck`: passed.
- `npm test`: 25 tests passed across 5 files after the 236-family Arabic expansion.
- `npm run test:e2e -- --trace off` with installed Chrome: all 20 browser scenarios passed. These include every Arabic/English family loading, licensed font ZIPs, editable copyleft sources, preserved SVG notices, variable/display/pan-Unicode Arabic SVGs, local font imports, failed requests, comparisons, preferences, mobile layout and dark mode.
- A short desktop viewport exposed an inaccessible local-font button in the sticky settings panel. The panel now scrolls internally. The denied-permission/import flow passed at 1280 × 600, and the mobile regression passed after this fix; five further export/comparison regressions also passed.
- `npm run build`: passed, including runtime-license notice generation.
- Production build with `VITE_BASE_PATH=/harf-qa/`: variable font loading, bundled WASM and actual outlined SVG download passed in the nested URL.
- `npm audit --omit=dev`: no known vulnerabilities reported in runtime dependencies at verification time.
- Desktop, dark-theme and 390 px mobile screenshots reviewed. No page errors were captured during screenshot generation; no horizontal mobile overflow.

The expanded catalog has 436 unique families: 236 support Arabic and 395 support English, with overlap for bilingual families. It contains 734 licensed font files: Google Fonts, 11 original creator families, 92 Debian-distributed families and 76 newly curated Arabic families. Source URLs and revisions are recorded per family in `src/data/fonts.json`. Tests inspect declared Arabic/English coverage and license presence for every file, and corresponding source presence for distribution families. Every unique family generated SVG outlines. All current Arabic and English families loaded in Chrome.

Synchronization rejects missing Arabic coverage, disconnected joining, unsupported outlines, duplicate files and repeated dialect variants. Source archives were verified against the SHA-256 checksums in pinned Debian source descriptors. Original upstream notices and font embedding exceptions are preserved in each relevant family download.

The curated adapter checks the complete basic Arabic alphabet and contextual joining, verifies direct font/archive SHA-256 hashes, pins creator commits and compares normalized Arabic paths and spacing. Tests reproduce each new family's recorded design fingerprint and reject repeated designs. Editable Glyphs/FontForge files are verified inside all copyleft creator source ZIPs. Browser checks parse attributed SVGs as valid XML and verify the full original license and source URL.

Notice extraction accepts only text notice names and bounds their size. A regression checks that reference images named Copyright do not enter UPSTREAM-NOTICES or inflate SVG metadata. Source snapshots preserve font vectors, licenses and build files while omitting reference graphics/PDFs with a readable bundle manifest.

Browser tests cover search, text changes, favorites persistence, two-font comparison, true SVG paths, licensed ZIP contents, all catalog previews, failed-load retry, missing-glyph blocking, TTF/WOFF2 import, denied/unsupported local access, normalization-supported transliteration, modal feedback, corrupt preferences/files, mobile layout, and dark-mode page colors and persistence.

The original independent review identified two issues which were fixed and regression-tested: status feedback outside the native comparison dialog, and raw cmap checks wrongly rejecting characters that HarfBuzz can normalize into supported glyphs.

Limitations remain explicit in the README: local font enumeration depends on support and permission; it inspects up to 500 families and selects one upright face per family. TTC collections are omitted. SVG is monochrome and respects explicit newlines, not preview soft wrapping. User font bytes do not survive reload. No live GitHub repository, Actions run or public deployment was created as part of local verification.
