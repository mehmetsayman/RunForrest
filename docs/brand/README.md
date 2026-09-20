# RunForrest — brand and design system

## The colours were taken from the source, not invented

The palette was extracted from the `sds-theme-dark` block of the
`@stellar/design-system@4.0.2` package. Not a guess, not "something close to
Stellar yellow" — the exact token values.

| Role | Token | Value |
|---|---|---|
| **Brand / primary** | `gold-09` | `#fdda24` |
| Primary light | `gold-10` | `#ffef5c` |
| Primary dark | `gold-11` | `#f0c000` |
| Secondary accent | `lilac-11` | `#9e8cfc` |
| Tertiary accent | `teal-11` | `#00c2d7` |
| Warning | `amber-09` | `#ffb224` |
| Success | `green-11` | `#4cc38a` |
| Error | `red-11` | `#ff6369` |
| Background | `base-00` | `#000000` |
| Surface | `gray-01` | `#161616` |
| Border | `gray-06` | `#343434` |
| Text | `gray-12` | `#ededed` |
| Muted text | `gray-11` | `#a0a0a0` |

> **Text on gold is always dark** (`#161616`). White text on a gold background
> does not clear the contrast threshold, which is why `--primary-foreground` is
> `#161616`.

## Typography

The Stellar Design System uses a single family and separates roles by weight and
letter spacing, not by a second family.

- **Inter** — body text and headings (with the `latin-ext` subset, which covers
  place names such as Çanakkale)
- **Inconsolata** — monospace: addresses, transaction hashes, technical labels

## Renaming tokens is not enough — the values have to change too

Adopting a design system is not a matter of renaming CSS variables. A name like
`--brand-light` can look right while the value underneath still belongs to a
different palette: consistent when you read the code, not on screen. So the
palette was extracted from `theme.scss` and every value matched to its
counterpart one by one.

For the same reason patterns like `text-white` needed attention: white text on a
gold background does not clear the contrast threshold. Do the colour swap
mechanically and accessibility failures like that slip in silently.

## Banner

`banner.png` — 1280×640 (the GitHub social preview standard), rendered at 2×
density.

To regenerate it:

```bash
cd docs/brand
npm i playwright && npx playwright install chromium
node render.mjs          # banner.html -> banner.png
```

Design rules (banner-design skill):
- Critical content sits inside the central 75% safe area
- At most two typefaces (Inter + Inconsolata)
- Headline ≥ 32px, body ≥ 16px
- Text/background contrast ≥ 4.5:1
- A single focal point

The line on the right is not decoration: it is a running route from a teal start
point to a gold finish — it says what the product does in one image.
