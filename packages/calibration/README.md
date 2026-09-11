# Web ladder calibration

The September 11, 2026 playtesting ladder meets its approved stopping rule for
all ten targets in Standard and Chess960: fitted estimates within 50 Elo of
the target, reported 95% interval half-width at most 100 Elo, and strictly
increasing fitted strength. Neighboring intervals may overlap. This is not a
claim that every adjacent opponent is statistically distinguishable.

## Conditions and limits

The candidate is the actual pinned Stockfish 18 Lite single-thread WASM, hosted
locally through the existing Node UCI adapter. Every session verifies the loader
and WASM bytes. Search uses 10,000 nodes, one thread, 16 MiB hash, MultiPV 1,
full strength, and no pondering, books or tablebases. Shared canonical chessops
rules and the position-derived xoshiro random selection match the application's
policy. Random legal moves are literal, without a hidden quality safeguard.

Standard and Chess960 are fitted separately. The controlled pools use five
Standard openings and ten Chess960 starting positions, color-reversed pairs,
and a 500-ply cap. An unfinished game excludes its entire pair from rating
input; it is never counted as a draw. The refit deduplicates pair identities
and reuses validated original PGNs rather than treating prior estimated
ratings as additional fixed anchors.

[BayesElo 0056](https://www.remi-coulom.fr/Bayesian-Elo/) estimates the pool
ratings. The existing Full Stockfish reference configured with UCI_Elo 1320
provides the reference offset under the same node budget. It is a reference,
not the engine shipped to players. The intervals below are the existing
`exactdist` output conditional on fitted opponent ratings and the documented
reference; they do not include human-anchor uncertainty or guarantee coverage
under repeated adaptive candidate selection. These are initial playtesting
estimates, not FIDE, Chess.com, Lichess or independently validated human ratings.

Node-hosted WASM evidence does not establish native C++ equivalence, browser
performance, or physical-device QA. Native calibration sharing remains gated.
Opponent calibration does not enable the separately unfinished player-rating
update system. Stockfish source/network, search or move-selection changes
invalidate the associated policy evidence; a version label alone is insufficient.

## Accepted settings

Randomness is a percentage of moves selected uniformly from legal moves. Each
row corresponds to the existing animal target, from Chicken through Raccoon.

| Target | Standard random % | Standard estimate (95% interval) | Chess960 random % | Chess960 estimate (95% interval) |
| ------ | ----------------- | -------------------------------- | ----------------- | -------------------------------- |
| 100    | 91.5              | 106 (27–183)                     | 85                | 121 (65–177)                     |
| 200    | 82                | 163 (107–219)                    | 81                | 194 (156–232)                    |
| 300    | 73.5              | 260 (210–309)                    | 77                | 306 (246–367)                    |
| 400    | 65.5              | 387 (343–432)                    | 66.5              | 438 (375–502)                    |
| 500    | 61.5              | 526 (480–572)                    | 60                | 518 (464–571)                    |
| 600    | 60                | 583 (518–648)                    | 57                | 633 (570–697)                    |
| 700    | 54                | 683 (621–745)                    | 50                | 711 (653–770)                    |
| 800    | 50                | 835 (755–916)                    | 43                | 828 (772–883)                    |
| 900    | 44.5              | 852 (785–919)                    | 38                | 927 (876–978)                    |
| 1000   | 38.5              | 989 (915–1062)                   | 36                | 957 (866–1049)                   |

The largest target error is 48 Elo; the largest one-sided interval radius is
92 Elo. These tolerances allow uneven measured step sizes. For example,
Standard 800 and 900 currently fit to 835 and 852, respectively. Further
playtesting can refine the spacing without pretending the two are already
strongly separated.

## Evidence identity

The final pools contain 840 scored Standard games (420 pairs, none excluded)
and 1,078 scored Chess960 games (539 pairs, one historical pair excluded).
The finishing pass added 560 games, all completed, after the earlier 80-game
cross-link diagnostic. Original reports remain unchanged. Generated raw
evidence and scratch records remain local-only; the curated acceptance fixture
pins each selected policy fingerprint, estimate, interval and game count.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Lite loader              | `2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe` |
| Lite WASM                | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |
| Standard combined PGN    | `cd2f7c01b982d064381e012fa03c81f7d8b9777e70b03e0f5d69135d74056ce0` |
| Chess960 combined PGN    | `8e4bd9b3443a600d675608a66d55f92a10e54b62ec9f681a72d432068d64d4fa` |
| Standard BayesElo stdout | `bac121ba9c66a6b7c21eea0973f81b8e9f993aa107237c1dc11b7c7ae2bc33e9` |
| Chess960 BayesElo stdout | `3c9e5edca8ed69e528d9084d7f7f6aca9615800a773c13e8ef61b96f2016ddc0` |

The focused acceptance tests protect preset/fingerprint correspondence and
the recorded tolerances. They do not rerun games or prove new measurements.
Existing local calibration helpers own execution, evidence validation and
estimation; ordinary CI still runs no engine matches. The report parser accepts
BayesElo's cumulative progress output above 1,000 games while rejecting unknown
results, unexpected diagnostics, regressing counts and incorrect final totals.
