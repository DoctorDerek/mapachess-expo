# Mapachess

[![Production](https://img.shields.io/website?url=https%3A%2F%2Fmapachess-expo-web.vercel.app%2F&up_message=live&down_message=offline&label=production&logo=vercel&logoColor=white)](https://mapachess-expo-web.vercel.app/) [![Codecov](https://codecov.io/gh/DoctorDerek/mapachess-expo/graph/badge.svg)](https://app.codecov.io/gh/DoctorDerek/mapachess-expo) [![ESLint, Vitest, and XState](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/eslint-vitest-xstate.yml/badge.svg?branch=main)](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/eslint-vitest-xstate.yml) [![Playwright](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/playwright.yml/badge.svg?branch=main)](https://github.com/DoctorDerek/mapachess-expo/actions/workflows/playwright.yml)

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

There is no public playable build yet. Difficulty labels, including Chicken
Stockfish at 100 Elo, remain internal and provisional until their evidence and
human playtesting gates are complete.

## Current repository

The implemented foundation currently provides:

- A strict TypeScript, pnpm, and Turborepo workspace.
- Explicit local provisioning of a pinned Stockfish 18 distribution and a typed
  Windows UCI process adapter.
- Deterministic, resumable, color-reversed calibration matches with preserved
  evidence and local BayesElo rating analysis.
- An evidence-ranked provisional Standard Chicken shortlist without automatic
  policy promotion or a public rating claim.
- Advisory ESLint, blocking TypeScript and tests, measured coverage reporting,
  dependency review, advisory XState topology visualization, deployed-preview
  Playwright coverage, and five-run Production Mobile Web Lighthouse reporting.

Stockfish and calibration executables, generated evidence, the private game
design document, commercial assets, and player data are never committed.
Ordinary CI never provisions or runs Stockfish and never plays calibration
games.

## Next implementation phases

1. Prove one typed Stockfish contract across a web WASM worker and Expo native
   modules.
2. Establish the shared web and mobile application foundation.
3. Deliver and playtest the complete Standard Story Chicken experience.

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

Real-engine verification is explicit and local only:

```powershell
corepack pnpm stockfish:provision
corepack pnpm test:integration:stockfish
```

## Production web deployment

The honest pre-production status page is live at
[mapachess-expo-web.vercel.app](https://mapachess-expo-web.vercel.app/). Vercel
creates Preview deployments for pull requests and Production deployments from
`main`. GitHub Actions runs Playwright against each trusted Preview deployment
and waits for each merged commit's matching Production deployment. It then
publishes the median of five Mobile Web Lighthouse runs against the canonical
Production URL and rejects audits that leave that origin.

The published Lighthouse report and dynamic scores are available through
[GitHub Pages](https://doctorderek.github.io/mapachess-expo/). The current
placeholder requires no environment variables or `vercel.json`. Local Vercel
project state remains ignored under `.vercel/`.

## Rights and third-party software

Original Mapachess application source code is copyright © 2026 Dr. Derek
Austin and licensed under the GNU General Public License version 3 or later.
See [LICENSE.txt](LICENSE.txt) for the complete license terms.

That application-code license does not relicense the private game design
document, commercial artwork, fonts, audio, or other separately licensed
non-code materials. Third-party software and assets retain their respective
licenses.

[Stockfish](https://github.com/official-stockfish/Stockfish) is distributed
under the GNU General Public License version 3. Any future distributed
Stockfish-powered Mapachess build must include the applicable notices and make
the complete corresponding source and build instructions available for the
exact distributed code. No distributable Mapachess build exists yet.
