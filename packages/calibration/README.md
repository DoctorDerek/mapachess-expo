# Web ladder calibration

## Initial pinned web baseline — September 28, 2026

The selected web roster has 23 targets per variant, 100–2300 Elo in 100-Elo steps. Its production probabilities and exact Node-calibration policy fingerprints are pinned in `packages/stockfish/src/webOpponentPolicy.ts` and independently checked against `test/webLadderAcceptanceFixture.ts`. Standard and Chess960 were fitted separately to 71,108 and 62,038 valid paired-game outcomes, respectively. Each color-reversed pair contributed both games or neither. The fixed working reference coordinate is Stockfish UCI_Elo 1320, with approximate CCRL lineage but unquantified absolute benchmark offset.

The numbers below are **reused-opening tuning estimates**, not fresh held-out results. Parentheses show the 95% _diagnostic_ interval from 200 complete-pair, edge-stratified bootstrap replicates of the same games. Those intervals condition on the observed policy graph and opening pool; they do not include adaptive-selection effects, new-opening transfer, or external-reference uncertainty.

| Target | Standard random bp | Standard fitted Elo (bootstrap 95%) | Chess960 random bp | Chess960 fitted Elo (bootstrap 95%) |
| -----: | -----------------: | ----------------------------------: | -----------------: | ----------------------------------: |
|    100 |               8425 |                      105 (48–165.1) |               8550 |                        110 (49–166) |
|    200 |               7800 |                   207 (155.9–262.2) |               8100 |                   190 (133.9–247.1) |
|    300 |               7225 |                     296 (242.9–353) |               7350 |                   307 (236.9–359.1) |
|    400 |               6750 |                     405 (354.9–458) |               6875 |                     402 (340.9–452) |
|    500 |               6225 |                     501 (456.9–556) |               6340 |                       494 (441–541) |
|    600 |               5650 |                       598 (545–654) |               5625 |                   605 (543.9–656.1) |
|    700 |               5200 |                       695 (642–755) |               5375 |                     703 (640–754.1) |
|    800 |               4650 |                       798 (746–856) |               4850 |                     790 (744.9–836) |
|    900 |               4140 |                     901 (860–938.1) |               4450 |                       903 (854–948) |
|   1000 |               3700 |                      991 (950–1036) |               3945 |                    990 (946.9–1027) |
|   1100 |               3216 |                  1108 (1065.9–1149) |               3500 |                    1109 (1063–1148) |
|   1200 |               2850 |                  1207 (1164–1242.1) |               3000 |                  1205 (1158–1244.1) |
|   1300 |               2550 |                    1295 (1264–1326) |               2625 |                  1294 (1248–1336.1) |
|   1400 |               2225 |                1396 (1359.9–1435.1) |               2340 |                  1391 (1343.9–1438) |
|   1500 |               1825 |                    1511 (1466–1556) |               1975 |                1498 (1454.9–1536.2) |
|   1600 |               1600 |                  1593 (1538.8–1645) |               1690 |                1590 (1547.9–1629.1) |
|   1700 |               1225 |                    1705 (1650–1756) |               1350 |                  1709 (1666.9–1753) |
|   1800 |                975 |                  1791 (1743.9–1843) |               1100 |                  1791 (1739–1841.1) |
|   1900 |                750 |                1900 (1846.8–1952.1) |                810 |                  1896 (1846–1940.1) |
|   2000 |                500 |                2006 (1951.9–2060.2) |                550 |                  1994 (1955.9–2031) |
|   2100 |                325 |                    2108 (2060–2163) |                388 |                  2110 (2057.9–2155) |
|   2200 |                200 |                  2199 (2150.9–2257) |                217 |                  2194 (2141.9–2244) |
|   2300 |                 80 |                  2289 (2239.9–2346) |                 80 |                2309 (2261.9–2355.1) |

The selected probabilities decrease strictly as target difficulty increases, and fitted estimates increase strictly. Standard has 21/23 targets within ±10 fitted Elo; 1500→1511 and 2300→2289 are the two one-Elo-over-boundary exceptions. Chess960 has 23/23 within ±10. Selected bootstrap interval radii span 31.0–60.1 Elo in Standard and 38.1–70.1 in Chess960. None establishes the former ≤20-Elo precision criterion. GDD v4.3 explicitly accepts these measured limitations for this **one-time pinned initial web baseline only**; do not extrapolate it to native, untested custom settings, or >2300.

The actual calibrated candidate used Stockfish 18 Lite single-thread WASM under the Node UCI adapter: pinned loader and WASM hashes, 10,000 nodes, one thread, 16 MiB hash, MultiPV 1, full strength, no pondering, no opening book or tablebases. Selection chooses Stockfish or a uniformly random canonical legal move at the listed probability using the shared position-derived deterministic algorithm. The browser uses the same pinned WASM and behavior but a distinct Worker UCI adapter. Its runtime fingerprint is therefore bound to, but not falsely identical with, the Node-calibration fingerprint; browser behavior must be checked before rated use. Story and matching Challenge target use the same selected policy irrespective of animal identity. Existing active matches retain their saved provisional policy on resume.

| Evidence owner                       | Standard                                                           | Chess960                                                           |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Valid games / complete pairs         | 71,108 / 35,554                                                    | 62,038 / 31,019                                                    |
| Excluded complete pairs              | 6                                                                  | 1                                                                  |
| Fitted policy identities             | 133                                                                | 140                                                                |
| Merged BayesElo input SHA-256        | `1ea0d1c5d823c382075df9b9edd2aa6e88f2bd093d3951bddf444c976abecc00` | `5ade76fc08a0d0e389b34cdd2137e8e9b04fec5cb461f1a2990bf5dd9b614fce` |
| Paired PGN SHA-256                   | `ed768ce89b19d111464e9d9cb576b30a89c743771e8edf8c8e80663d957ec5ba` | `f05d6625bb4aecb07ec305e42adaeb039a5321b5dcdfbd9890e1121ec4fcb0ca` |
| 200-replicate bootstrap JSON SHA-256 | `ed135fbf510540d130b2342b08a9cf76874ecb69e8f347038d9e8d0b440048b5` | `94d75b47ab7489e8fbba856da8fbc5ab2b46cc6c137800d149e17d0b9e887925` |

The calibration runner uses BayesElo 0056 with `minelo -4500`, `maxelo 4500`, `resolution 3001`, `exactdist`, then `offset 1320` on the reference alias. Stage10 Standard (seed61) and Stage9 Chess960 (seed60) cumulative fits include the preceding valid batches and seeds; they are **not** independent holdouts. Local raw PGNs, plans, complete results and analysis helpers are Git ignored; this report, pinned fingerprints, and acceptance fixture are the reviewable provenance. The campaign consumed more than five days of local computation/analysis. Future precision work needs an information-efficient graph, fresh reserved openings/seeds and explicit benchmark bridge rather than another same-opening batch.

## Historical September 2026 playtesting ladder

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
