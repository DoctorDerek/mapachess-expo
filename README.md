# Mapachess

[![Production](https://img.shields.io/website?url=https%3A%2F%2Fmapachess.com%2F&up_message=live&down_message=offline&label=production&logo=vercel&logoColor=white)](https://mapachess.com/) [![Codecov](https://codecov.io/gh/DoctorDerek/mapachess-expo/graph/badge.svg)](https://app.codecov.io/gh/DoctorDerek/mapachess-expo) [![ESLint, Vitest, and XState](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/eslint-vitest-xstate.yml/badge.svg?branch=main)](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/eslint-vitest-xstate.yml) [![Playwright](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/playwright.yml)

[![Mobile Web Lighthouse Performance](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fmapachess-expo%2Flighthouse-results.json&query=%24.performance&label=performance&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/mapachess-expo/) [![Mobile Web Lighthouse Accessibility](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fmapachess-expo%2Flighthouse-results.json&query=%24.accessibility&label=accessibility&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/mapachess-expo/) [![Mobile Web Lighthouse Best Practices](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fmapachess-expo%2Flighthouse-results.json&query=%24.bestPractices&label=best%20practices&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/mapachess-expo/) [![Mobile Web Lighthouse SEO](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fdoctorderek.github.io%2Fmapachess-expo%2Flighthouse-results.json&query=%24.seo&label=SEO&suffix=%2F100&logo=lighthouse&logoColor=white&color=informational)](https://doctorderek.github.io/mapachess-expo/)

Mapachess is a permanently free, accountless, offline-first chess game in
pre-production. Its defining design combines:

- Three Piece Hints for each side, followed by three Move Hints for those pieces
  for each side.
- Stockfish-powered animal opponents authored from 100 through 2300 Elo, with
  independently selected unlocked animals and calibrated difficulty through
  3000+ Elo in Challenge.
- A Reactive Battle Stage with animated animal combat and Mapachito coach
  portrait reactions.
- Standard and Chess960 across Story and Challenge, with four separately tracked
  player Elo ratings.

The current web development build offers ten Story opponents, Chicken through
Raccoon, in both Standard and Chess960. Win to unlock the next animal, or replay
earlier opponents to improve your medal. Each variant retains its own victories
and best medals, and active matches save locally for reload and restart.
The 100–1000 web difficulty presets meet the approved engine-pool calibration
tolerances in both variants; they are estimates, not certified human ratings.
Six targets share their random-move setting; four measured Chess960 exceptions
remain in the same canonical schedule and difficulty implementation.
These matches still do not update player Elo. Challenge supports independently
selected earned animals and difficulty, side, and Chess960-position selection.
XP/Levels, achievements, and player-rating updates remain in development.
See the [calibration conditions and measured results](packages/calibration/README.md).

## Current repository

The implemented foundation currently provides:

- A strict TypeScript, pnpm, and Turborepo workspace.
- Explicit local provisioning of a pinned Stockfish 18 distribution and a typed
  Windows UCI process adapter.
- Deterministic, resumable, color-reversed calibration matches with preserved
  evidence and local BayesElo rating analysis.
- Calibrated Standard and Chess960 100–1000 opponent presets using the pinned
  web Lite WASM artifacts, without automatic player-rating promotion.
- Durable Standard and Chess960 browser matches with exact Better Hints, evaluation,
  Undo/Redo, Resign, Offer Draw, reload recovery, Restart Match, and Return to
  Menu.
- Advisory ESLint, blocking TypeScript and tests, measured coverage reporting,
  dependency review, advisory XState topology visualization, deployed-preview
  Playwright coverage, and five-run Production Mobile Web Lighthouse reporting.

Stockfish and calibration executables, generated evidence, the private game
design document, commercial assets, and player data are never committed. Web
builds provision the exact pinned browser runtime, but ordinary GitHub quality
CI never runs Stockfish or calibration games.

## Next implementation phases

1. Playtest and complete the first Standard Story opponent's full QREAM
   presentation, results, progression, and responsive behavior.
2. Expand the same shared architecture across all twenty-three Story opponents
   without making Chicken the owner of reusable behavior.
3. Complete Chess960 Story and both Challenge modes through the same canonical
   match, profile, and engine contracts.

The planned application stack uses Next.js, React, Tailwind CSS, shadcn/ui, and
Motion for web; React Native, Expo, Uniwind, React Native Reusables, and React
Native Reanimated for native; and shared TypeScript and XState domain behavior
across both platforms.

## Local development

Use [fnm](https://github.com/Schniz/fnm) to select the repository's Node version
and [pnpm](https://pnpm.io/) through Corepack:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use
corepack pnpm install --frozen-lockfile
```

Run the ordinary quality gates with:

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:coverage
corepack pnpm test:xstate-diff
corepack pnpm test:lighthouse
corepack pnpm build
corepack pnpm test:e2e
```

Native-engine, calibration, and dedicated browser-engine verification remain
explicit rather than part of ordinary quality CI:

```powershell
corepack pnpm stockfish:provision
corepack pnpm stockfish:provision:web
corepack pnpm test:integration:stockfish
```

The browser candidate's exact release artifacts, digests, source revisions, and
build-time provisioning boundary are recorded in
[packages/stockfish/WEB_RUNTIME.md](packages/stockfish/WEB_RUNTIME.md).

## Production web deployment

[Mapachess.com](https://www.mapachess.com/) is live at the canonical `www` origin;
the bare domain redirects there. Automated Lighthouse reporting targets
`https://www.mapachess.com/` directly. Vercel creates Preview
deployments for pull requests and Production deployments from
`main`. GitHub Actions runs Playwright against each trusted Preview deployment
and waits for each merged commit's matching Production deployment. It then
publishes the run with the median Performance score from five standard mobile
Lighthouse runs against Mapachess.com and rejects audits that leave that
origin. The generated Vercel deployment URL verifies readiness of the matching
commit; it is not the measurement target.

The published Lighthouse report and dynamic scores are available through
[GitHub Pages](https://doctorderek.github.io/mapachess-expo/). The application
requires no playtest flag or `vercel.json`; each web build provisions and
verifies the pinned same-origin Stockfish.js runtime before Next.js compiles.
Local Vercel project state remains ignored under `.vercel/`.

Licensed Battle Stage and coach artwork uses the private
`GHOST_ASSET_KEY_MAPACHESS` secret for clean cloud builds. The project owner has
configured the same existing key in Development, Preview, and Production on
both Vercel and EAS. There is no public presentation-mode setting.

The existing preparation helper automatically publishes verified local vendor
files when available, otherwise decrypts the archive with the supplied key,
otherwise uses authored public placeholders. Invalid required keyed inputs fail
the build. Web preparation runs before application cache restoration, and the
renderer's availability is derived from the prepared files. Successful deployment
status alone does not prove licensed artwork shipped. See
[licensed asset setup](ghost_assets/README.md) for source ownership, cache
behavior, and safe verification.

The current EAS hook provisions native Stockfish only. Its secret is configured,
but native animal presentation still needs its consumer and build integration;
secret configuration and verified native asset delivery are separate milestones.

## Rights and third-party software

Original Mapachess application source code is copyright © 2026 Dr. Derek
Austin and licensed under the GNU General Public License version 3 or later.
See [LICENSE.txt](LICENSE.txt) for the complete license terms.

That application-code license does not relicense the private game design
document, commercial artwork, fonts, audio, or other separately licensed
non-code materials. Third-party software and assets retain their respective
licenses.

[Stockfish](https://github.com/official-stockfish/Stockfish) is distributed
under the GNU General Public License version 3. Mapachess web builds distribute
the pinned Stockfish.js runtime documented in
[packages/stockfish/WEB_RUNTIME.md](packages/stockfish/WEB_RUNTIME.md), including
the exact corresponding source revisions, upstream license, and source-build
instructions.
