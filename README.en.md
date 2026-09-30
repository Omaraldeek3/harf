# Harf — Arabic & English Font Preview

An open-source typography studio with separate Arabic and English sections. The catalog contains 236 Arabic-capable and 395 English-capable families: 436 unique families total, with bilingual fonts appearing in both sections. Compare up to four fonts, save favorites, download licensed archives and export shaped SVG outlines.

[العربية](README.md) · [Contributing](CONTRIBUTING.md) · [Privacy](PRIVACY.md)

![Harf typography studio](docs/images/desktop.png)

## Run

Requires Node.js 24+ and npm.

```bash
npm ci
npm run dev
```

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Set `PLAYWRIGHT_CHANNEL=chrome` to test with installed Google Chrome. All font assets are included; the production build requires no font API or API key. Upload the contents of this directory to an independent repository root.

## Features

- Arabic RTL interface with separate language sections, responsive layout, dark mode and keyboard-accessible dialogs.
- Independent Arabic/English preview text retained while switching, with correct RTL/LTR shaping and punctuation.
- Search, categories, local favorites and side-by-side comparison.
- Real available font weights, color and alignment controls.
- Lazy-loaded font previews with visible errors, retry and missing-character warnings.
- Optional Local Font Access permission, plus TTF/OTF/WOFF/WOFF2 import and validation.
- Whole-family ZIP downloads including original licenses.
- HarfBuzz shaping and Unicode bidi resolution for real SVG paths, including Arabic joining and marks.

The catalog contains 734 font files, verified on September 30, 2026. It combines Google Fonts, 11 original creator families, 92 families from Debian-distributed open-source collections and 76 more curated Arabic-capable families. The latest additions include Font Store, Alif Type, X Series, Layla, Kurinto, Mikhak, Ario and Kitab. Some also serve Persian or Uyghur. The new curated families pass Arabic alphabet coverage, joining, shaping and outline checks, and are compared against existing Arabic designs to avoid duplicates. See the [source review](docs/catalog-sources.md).

Font files, licenses, source URLs and each source revision are pinned in `src/data/fonts.json`. Run `npm run fonts:sync` to refresh the catalog; review changes before accepting them. The distribution adapter requires an xz-capable `tar`, uses pinned package versions and verifies corresponding source archives against SHA-256 checksums. Its transient `.font-cache/` is excluded from the source ZIP and Git.

Curated sources are pinned in `scripts/curated-font-sources.mjs`. Original archive and direct font bytes are verified against SHA-256 checksums. The complete original licenses embedded in Layla and Kurinto fonts are also copied to readable text files. Kurinto synchronization fetches only selected font members using verified byte ranges instead of downloading the full multi-gigabyte collection.

## Deploy to GitHub Pages

Choose **GitHub Actions** under repository **Settings → Pages**. Run **Deploy to GitHub Pages** manually from the Actions tab. The workflow calculates the repository base path automatically; account `username.github.io` repositories are supported. CI runs on pushes and pull requests to main/master.

Other static hosts can serve `dist/`. Set `VITE_BASE_PATH=/your-subdirectory/` for a custom nested path. Default relative URLs also support ordinary static hosting. Keep secrets out of `VITE_*` variables.

## Honest limits

Local font enumeration depends on browser support, secure context and user permission, usually desktop Chromium browsers. Up to 500 families are inspected; one upright face per family is imported. Font collections and faces without supported outlines are skipped. Imported/local bytes exist only in memory and disappear on reload. Imports accept at most 20 files, each up to 32 MiB.

SVG exports are monochrome and preserve explicit newlines; automatic preview wrapping is not reproduced. Missing characters block export rather than producing replacement glyphs. Variable weight axes are supported; other axes use their defaults. This is a static application, not a PWA with guaranteed offline reopening.

## Privacy and licensing

No accounts, analytics or upload endpoints. Text and user fonts stay in the browser; favorites and theme use localStorage. Bundled fonts are served from the same host. Normal host access logs may still record requests.

The application is MIT licensed. Every bundled font retains its own license, included in downloads. Additional distribution families include original notices, corresponding source archives and Debian build recipes from `public/font-sources/`, preserving font embedding exceptions where provided. A local font is not automatically free to use or redistribute. See [third-party notices](THIRD_PARTY_NOTICES.md).

Six Alif Type families use AGPL-3.0, displayed on their cards. Their downloads include editable upstream font sources, build files and original notices. Corresponding source snapshots omit reference graphics and publication PDFs; editor background-image references remain unchanged and refer to assets in the original repository. SVG exports retain the font's original copyright, full license and source link in metadata. Font licensing remains independent of the application's MIT license.
