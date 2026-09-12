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

One canonical schedule supplies both variants. Six targets share a percentage;
only 100, 700, 800 and 900 have explicit Chess960 exceptions. Story and Challenge
consume the same settings and move-selection implementation. Separate validation
pools do not create separate player-facing rating systems or duplicate difficulty
logic.

Randomness is a percentage of moves selected uniformly from legal moves. Each
row corresponds to the existing animal target, from Chicken through Raccoon.

| Target | Standard random % | Standard estimate (95% interval) | Chess960 random % | Chess960 estimate (95% interval) |
| ------ | ----------------- | -------------------------------- | ----------------- | -------------------------------- |
| 100    | 90                | 83 (49–117)                      | 83.5              | 82 (50–114)                      |
| 200    | 80                | 194 (161–226)                    | 80                | 197 (166–228)                    |
| 300    | 73.5              | 291 (268–314)                    | 73.5              | 258 (232–284)                    |
| 400    | 65.5              | 433 (414–452)                    | 65.5              | 429 (408–450)                    |
| 500    | 61.5              | 498 (474–522)                    | 61.5              | 511 (482–540)                    |
| 600    | 55                | 608 (578–638)                    | 55                | 638 (607–669)                    |
| 700    | 50                | 701 (682–720)                    | 54                | 684 (657–711)                    |
| 800    | 44.5              | 813 (787–839)                    | 50                | 780 (761–799)                    |
| 900    | 38.5              | 950 (917–983)                    | 44.5              | 901 (873–929)                    |
| 1000   | 36.5              | 988 (953–1023)                   | 36.5              | 1012 (978–1046)                  |

The largest target error is 50 Elo; the largest one-sided reported interval
radius is 35 Elo, compared with 92 in the earlier fit. Each selected policy has
240–1,120 recorded games. These tolerances still allow uneven measured steps:
Standard 900 and 1000 fit to 950 and 988, respectively. Their intervals overlap;
this is not proof of a distinct 100-Elo gap.

### Why four exceptions remain

The original Standard schedule was tested unchanged in both variants with a
fresh seed, followed by a revised shared schedule and focused cross-links.
Neither complete shared candidate met the same target tolerances. The final
cumulative fit includes all valid historical and additional evidence, not just
games favorable to the selected settings.

Copying the final Standard setting at each exception would give these Chess960
results:

| Target | Copied random % | Chess960 estimate (95% interval) | Accepted point-estimate range |
| ------ | --------------- | -------------------------------- | ----------------------------- |
| 100    | 90              | -11 (-41–19)                     | 50–150                        |
| 700    | 50              | 780 (761–799)                    | 650–750                       |
| 800    | 44.5            | 901 (873–929)                    | 750–850                       |
| 900    | 38.5            | 1013 (978–1048)                  | 850–950                       |

Each of these reported conditional intervals lies outside the target's accepted
range. This supports exceptions to the tested Standard settings in this pool;
it does not prove that no untested shared percentage could ever work. No target
tolerance was relaxed, and no legacy difficulty table or migration was added.

## Evidence identity

The final pools contain 6,436 scored Standard games (3,218 pairs, two capped pairs
excluded) and 6,678 scored Chess960 games (3,339 pairs, one historical capped pair
excluded): 13,114 scored games total. The review added 11,200 game outcomes
across fresh seeds 43, 44 and 45; four outcomes were excluded with their capped
Standard pairs. The focused seed-45 comparisons completed all 2,400 games.

An initial review launcher incorrectly routed reference seats through Lite;
that entire batch was rejected and is absent from these pools. The replacement
launcher follows the existing adapter routing and checks the installed reference
identity. Original valid reports remain unchanged. Generated raw evidence and
scratch records remain local-only; the curated acceptance fixture pins each
selected policy fingerprint, estimate, interval and game count.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Lite loader              | `2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe` |
| Lite WASM                | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |
| Standard combined PGN    | `ea5326accd8d5a07b6abfc8b1c55fd82d13126e0d4d81122fbd94cdb81ba96b7` |
| Chess960 combined PGN    | `85aa5d9aeaa7930fd5ff30718d2bea6015b3ff11c865709699639830f2598060` |
| Standard BayesElo stdout | `48d9792cc28562d68d763bb998f896e97a3df41fcbf1ea01a46db4cb4bdf916c` |
| Chess960 BayesElo stdout | `47fac6add775e17cd988135448bee5296f571554d620efc4012a23e250128bca` |

The focused acceptance tests protect preset/fingerprint correspondence and
the recorded tolerances. They do not rerun games or prove new measurements.
Existing local calibration helpers own execution, evidence validation and
estimation; ordinary CI still runs no engine matches. The report parser accepts
BayesElo's cumulative progress output above 1,000 games while rejecting unknown
results, unexpected diagnostics, regressing counts and incorrect final totals.

## Complete Story ladder extension — September 12, 2026

All thirteen remaining targets (1100–2300) meet the same stopping rule in both
variants using one shared probability schedule. The first ten probabilities and
their four established exceptions are unchanged. Their final cumulative estimates
also still pass; the acceptance fixture now records this cumulative fit for all
23 targets. The earlier tables above retain the dated first-ten evidence, not a
second policy table.

| Target | Shared random % | Standard estimate (95% interval) | Chess960 estimate (95% interval) | Games per variant |
| ------ | --------------- | -------------------------------- | -------------------------------- | ----------------- |
| 1100   | 32              | 1098 (1062–1134)                 | 1142 (1107–1178)                 | 320               |
| 1200   | 28              | 1239 (1203–1275)                 | 1222 (1187–1257)                 | 320               |
| 1300   | 25.5            | 1299 (1270–1328)                 | 1320 (1291–1349)                 | 480               |
| 1400   | 23.25           | 1397 (1360–1434)                 | 1414 (1378–1450)                 | 320               |
| 1500   | 20              | 1505 (1479–1531)                 | 1495 (1469–1521)                 | 640               |
| 1600   | 17.25           | 1582 (1557–1607)                 | 1588 (1563–1614)                 | 640               |
| 1700   | 13.5            | 1709 (1680–1738)                 | 1725 (1696–1755)                 | 480               |
| 1800   | 11.25           | 1784 (1757–1811)                 | 1803 (1776–1830)                 | 640               |
| 1900   | 8.25            | 1948 (1911–1985)                 | 1900 (1864–1936)                 | 320               |
| 2000   | 5.5             | 2036 (2017–2055)                 | 2012 (1993–2031)                 | 1440              |
| 2100   | 4               | 2115 (2064–2166)                 | 2075 (2024–2126)                 | 160               |
| 2200   | 2.5             | 2189 (2164–2214)                 | 2153 (2127–2179)                 | 640               |
| 2300   | 0.8             | 2323 (2299–2347)                 | 2303 (2278–2328)                 | 640               |

The largest new-target error is 48 Elo and the largest new interval radius is
51 Elo. These remain conditional pool estimates, not independently certified
human ratings or proof of non-overlapping adjacent strengths. No tolerances were
relaxed. No new variant exceptions, Full runtime, or search-budget changes were
needed. The original ten also remain within 50 Elo in this cumulative fit
(including Chess960 600 at 650); their previously accepted settings are preserved.

The extension adds 13,600 scored games across seeds 46–50, including direct
reference and intermediate-strength cross-links rather than relying only on a
long adjacent-opponent chain. All new pairs completed. Cumulative input contains
13,236 Standard games and 13,478 Chess960 games (26,714 total), with the same
historical capped-pair exclusions and rejected routing batch described above.
All valid candidate results remain in the cumulative fit, including candidates
not selected for activation.

The wider pool exposed clipping in BayesElo's default integration range. The
runner now sets `minelo -4500`, `maxelo 4500`, and `resolution 3001` before
`exactdist`, retaining the original 3-Elo grid spacing. The point-estimation
model, reference offset and strict output validation are unchanged. Reusing the
same captured input verified the numerical correction without rerunning matches.

| Cumulative artifact      | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Standard PGN             | `0b6bdc5bd00309cd833590e06a9b7ec8151c0a5130e245ea74f65187eac764fa` |
| Chess960 PGN             | `6527a7b5f6ba58aaaf8266d2ee9392e70056888d80162a3e78c0c32b0137eba4` |
| Standard BayesElo stdout | `67d6eea25395a1cecff49103b72ebd652f623e94a6883310e3a324549870a7ef` |
| Chess960 BayesElo stdout | `ed5af0b0be38a9c758a0f92e54782963eb6814621cff00c4da43e5af8b07b670` |

Story now supports the entire earned roster through Dragonfly. Challenge shares
these 100–2300 presets while keeping animal selection independent and earned.
Native equivalence and difficulty above 2300 remain separate evidence gates;
this extension does not certify either or enable player-rating updates.
