# 0001 - Element to source link

Status: accepted (2026-11-20). Measured on Slidev 53.1.0.

## Question

Can a rendered element be tied to its exact line in `slides.md` using only an addon?

## Tried and observed

| Attempt | Outcome |
| ------- | ------- |
| Inspect the rendered slide in headless Chromium | Slides carry `data-slidev-no`. Elements carry no source-line attribute (`<p>`, `<li>` and `<pre>` have only Vue scope attributes). |
| Inject a markdown-it plugin that copies `token.map` into attributes | Not reachable from an addon. Slidev builds its markdown plugin from the `slidev` key of the user's `vite.config`, read when the plugins are created, before `setup/vite-plugins.ts` runs. It would require the deck to own a `vite.config.ts`, which breaks "addon only". |
| Read the deck model in `setup/vite-plugins.ts` | Works. The hook receives Slidev's resolved options: `options.data.slides[n].source` (`filepath`, `start`, `contentStart`, `content`), plus `userRoot`. Slide granularity only, no per-element data. |
| Both a server hook and a global layer in one addon | Works: `setup/vite-plugins.ts` and `global-top.vue` load from the same addon package. |

## Decision

- The product ships slide + text excerpt + selector as the guaranteed locator.
- `line` stays optional. It is filled best-effort on the server by locating the excerpt inside the slide's source (see phase 5), never trusted as exact. It is a hint: the match is the first source line that starts or contains the rendered text once inline markdown (bold, links, code) and a trailing excerpt ellipsis are dropped, so it can be missing (text built by a component or across lines) or wrong (repeated text).
- The prompt tells the agent the line is a hint and the excerpt is authoritative.

## Unverified

- Behavior with decks split over several markdown files (`src:` imports).
- Excerpts that appear more than once in the same slide: the first match wins.
