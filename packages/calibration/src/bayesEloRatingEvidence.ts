import { createHash } from "node:crypto"
import { BAYES_ELO_EXECUTABLE_IDENTITY } from "./bayesEloIdentity.js"
import type {
  BayesEloInput,
  BayesEloPolicyAlias,
  BayesEloPolicyAliasRecord,
} from "./bayesEloInput.js"
import type { OpponentPolicyFingerprint } from "./opponentPolicy.js"

export const BAYES_ELO_RATING_EVIDENCE_SCHEMA_VERSION = 1 as const

export type BayesEloBridgeOffset = Readonly<{
  anchorElo: number
  alias: BayesEloPolicyAlias
  policyFingerprint: OpponentPolicyFingerprint
}>

export type BayesEloRating = Readonly<{
  alias: BayesEloPolicyAlias
  averageOpponentElo: number
  confidence95: Readonly<{
    lowerElo: number
    upperElo: number
  }>
  drawPercent: number
  estimateElo: number
  games: number
  policyFingerprint: OpponentPolicyFingerprint
  rank: number
  scorePercent: number
}>

export type BayesEloLikelihoodOfSuperiority = Readonly<{
  opponentAlias: BayesEloPolicyAlias
  opponentPolicyFingerprint: OpponentPolicyFingerprint
  policyAlias: BayesEloPolicyAlias
  policyFingerprint: OpponentPolicyFingerprint
  probabilityBasisPoints: number
}>

export type BayesEloRatingEvidence = Readonly<{
  schemaVersion: typeof BAYES_ELO_RATING_EVIDENCE_SCHEMA_VERSION
  bridgeOffset: BayesEloBridgeOffset
  completedGameCount: number
  completedPairCount: number
  excludedPairCount: number
  inputSha256: BayesEloInput["inputSha256"]
  likelihoodOfSuperiority: readonly BayesEloLikelihoodOfSuperiority[]
  observedVersion: typeof BAYES_ELO_EXECUTABLE_IDENTITY.version
  pgnSha256: BayesEloInput["pgnSha256"]
  planId: BayesEloInput["planId"]
  ratings: readonly BayesEloRating[]
  tool: typeof BAYES_ELO_EXECUTABLE_IDENTITY
  transcript: Readonly<{
    stderr: string
    stderrSha256: string
    stdout: string
    stdoutSha256: string
  }>
  variant: "standard"
}>

export type ParseBayesEloRatingEvidenceInput = Readonly<{
  bridgeOffset: BayesEloBridgeOffset
  input: BayesEloInput
  stderr: string
  stdout: string
}>

type ParsedRatingRow = Readonly<{
  alias: BayesEloPolicyAlias
  averageOpponentElo: number
  drawPercent: number
  estimateElo: number
  games: number
  minus: number
  plus: number
  rank: number
  scorePercent: number
}>

const RATING_ROW_PATTERN =
  /^\s*(\d+)\s+(P\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(-?\d+)\s+(\d+)%\s*$/
const POLICY_ALIAS_PATTERN = /^P\d+$/

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function parseSafeInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`${label} must be a safe integer.`)
  }

  return parsed
}

function normalizedOutputLines(stdout: string): readonly string[] {
  return stdout
    .replaceAll("\r", "\n")
    .split("\n")
    .map((line) =>
      line.replace(/(?:ResultSet-EloRating>|ResultSet>)/g, "").trim(),
    )
    .filter((line) => line.length > 0)
}

function aliasRecordsByAlias(
  policyAliases: readonly BayesEloPolicyAliasRecord[],
): ReadonlyMap<BayesEloPolicyAlias, BayesEloPolicyAliasRecord> {
  return new Map(policyAliases.map((record) => [record.alias, record]))
}

function parseRatingRows(lines: readonly string[]): readonly ParsedRatingRow[] {
  const headerIndex = lines.findIndex((line) => line.startsWith("Rank Name"))
  if (headerIndex === -1) {
    throw new TypeError("BayesElo ratings header is missing.")
  }

  const ratings: ParsedRatingRow[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    const match = RATING_ROW_PATTERN.exec(line)
    if (match === null) {
      if (ratings.length > 0) break
      continue
    }

    const [
      ,
      rank,
      alias,
      estimateElo,
      plus,
      minus,
      games,
      scorePercent,
      averageOpponentElo,
      drawPercent,
    ] = match
    if (
      rank === undefined ||
      alias === undefined ||
      estimateElo === undefined ||
      plus === undefined ||
      minus === undefined ||
      games === undefined ||
      scorePercent === undefined ||
      averageOpponentElo === undefined ||
      drawPercent === undefined
    ) {
      throw new TypeError("BayesElo rating row is incomplete.")
    }

    ratings.push({
      rank: parseSafeInteger(rank, "BayesElo rank"),
      alias: alias as BayesEloPolicyAlias,
      estimateElo: parseSafeInteger(estimateElo, "BayesElo estimate"),
      plus: parseSafeInteger(plus, "BayesElo upper interval"),
      minus: parseSafeInteger(minus, "BayesElo lower interval"),
      games: parseSafeInteger(games, "BayesElo games"),
      scorePercent: parseSafeInteger(scorePercent, "BayesElo score"),
      averageOpponentElo: parseSafeInteger(
        averageOpponentElo,
        "BayesElo average opponent",
      ),
      drawPercent: parseSafeInteger(drawPercent, "BayesElo draws"),
    })
  }

  if (ratings.length < 2) {
    throw new TypeError("BayesElo requires at least two rated policies.")
  }

  return ratings
}

function parseLikelihoodMatrix(
  lines: readonly string[],
  ratings: readonly ParsedRatingRow[],
  aliases: ReadonlyMap<BayesEloPolicyAlias, BayesEloPolicyAliasRecord>,
): readonly BayesEloLikelihoodOfSuperiority[] {
  const ratingAliases = new Set(ratings.map(({ alias }) => alias))
  const headerIndex = lines.findIndex((line) => {
    const cells = line.split(/\s+/)
    return (
      cells.length === ratings.length &&
      cells.every((cell) => ratingAliases.has(cell as BayesEloPolicyAlias))
    )
  })
  if (headerIndex === -1) {
    throw new TypeError("BayesElo likelihood header is missing.")
  }

  const columns = lines[headerIndex]
    ?.split(/\s+/)
    .map((alias) => alias as BayesEloPolicyAlias)
  if (columns === undefined) {
    throw new TypeError("BayesElo likelihood columns are missing.")
  }

  const likelihoods: BayesEloLikelihoodOfSuperiority[] = []
  const seenRows = new Set<BayesEloPolicyAlias>()
  for (const line of lines.slice(
    headerIndex + 1,
    headerIndex + 1 + columns.length,
  )) {
    const [rawRowAlias, ...rawValues] = line.split(/\s+/)
    if (rawRowAlias === undefined || !POLICY_ALIAS_PATTERN.test(rawRowAlias)) {
      throw new TypeError("BayesElo likelihood row alias is invalid.")
    }

    const rowAlias = rawRowAlias as BayesEloPolicyAlias
    if (!ratingAliases.has(rowAlias) || seenRows.has(rowAlias)) {
      throw new TypeError("BayesElo likelihood row identity is invalid.")
    }
    if (rawValues.length !== columns.length - 1) {
      throw new TypeError("BayesElo likelihood row width is invalid.")
    }

    const policy = aliases.get(rowAlias)
    if (policy === undefined) {
      throw new TypeError(`Unknown BayesElo policy alias: ${rowAlias}.`)
    }

    seenRows.add(rowAlias)
    let valueIndex = 0
    for (const opponentAlias of columns) {
      if (opponentAlias === rowAlias) continue
      const rawProbability = rawValues[valueIndex]
      if (rawProbability === undefined) {
        throw new TypeError("BayesElo likelihood value is missing.")
      }
      const probabilityBasisPoints = parseSafeInteger(
        rawProbability,
        "BayesElo likelihood",
      )
      if (probabilityBasisPoints < 0 || probabilityBasisPoints > 10_000) {
        throw new TypeError(
          "BayesElo likelihood must be between 0 and 10000 basis points.",
        )
      }

      const opponent = aliases.get(opponentAlias)
      if (opponent === undefined) {
        throw new TypeError(`Unknown BayesElo policy alias: ${opponentAlias}.`)
      }
      likelihoods.push({
        policyAlias: rowAlias,
        policyFingerprint: policy.policyFingerprint,
        opponentAlias,
        opponentPolicyFingerprint: opponent.policyFingerprint,
        probabilityBasisPoints,
      })
      valueIndex += 1
    }
  }

  if (seenRows.size !== columns.length) {
    throw new TypeError("BayesElo likelihood matrix is incomplete.")
  }

  return likelihoods
}

export default function parseBayesEloRatingEvidence(
  input: ParseBayesEloRatingEvidenceInput,
): BayesEloRatingEvidence {
  const version = /\bversion\s+(\d{4}),/.exec(input.stdout)?.[1]
  if (version !== BAYES_ELO_EXECUTABLE_IDENTITY.version) {
    throw new TypeError(
      `BayesElo version mismatch: expected ${BAYES_ELO_EXECUTABLE_IDENTITY.version}, received ${version ?? "none"}.`,
    )
  }

  const lines = normalizedOutputLines(`${input.stdout}\n${input.stderr}`)
  const normalized = lines.join("\n")
  const loadedMatch =
    /(\d+) game\(s\) loaded, (\d+) game\(s\) with unknown result ignored\./.exec(
      normalized,
    )
  if (loadedMatch === null) {
    throw new TypeError("BayesElo loaded-game summary is missing.")
  }
  const loadedGames = parseSafeInteger(loadedMatch[1] ?? "", "loaded games")
  const ignoredGames = parseSafeInteger(loadedMatch[2] ?? "", "ignored games")
  const expectedStderr = `${loadedGames} game(s) loaded, ${ignoredGames} game(s) with unknown result ignored.`
  if (input.stderr.trim() !== expectedStderr) {
    throw new Error(
      `BayesElo stderr did not match its loaded-game summary: ${input.stderr.trim() || "none"}.`,
    )
  }
  if (loadedGames !== input.input.completedGameCount || ignoredGames !== 0) {
    throw new TypeError(
      `BayesElo loaded ${loadedGames} games and ignored ${ignoredGames}; expected ${input.input.completedGameCount} loaded and 0 ignored.`,
    )
  }

  const aliases = aliasRecordsByAlias(input.input.policyAliases)
  if (aliases.size !== input.input.policyAliases.length) {
    throw new TypeError("BayesElo input contains duplicate policy aliases.")
  }
  const parsedRatings = parseRatingRows(lines)
  const seenAliases = new Set<BayesEloPolicyAlias>()
  const ratings = parsedRatings.map((rating): BayesEloRating => {
    const aliasRecord = aliases.get(rating.alias)
    if (aliasRecord === undefined || seenAliases.has(rating.alias)) {
      throw new TypeError(
        `Unknown or duplicate BayesElo rating alias: ${rating.alias}.`,
      )
    }
    seenAliases.add(rating.alias)

    return {
      rank: rating.rank,
      alias: rating.alias,
      policyFingerprint: aliasRecord.policyFingerprint,
      estimateElo: rating.estimateElo,
      confidence95: {
        lowerElo: rating.estimateElo - rating.minus,
        upperElo: rating.estimateElo + rating.plus,
      },
      games: rating.games,
      scorePercent: rating.scorePercent,
      averageOpponentElo: rating.averageOpponentElo,
      drawPercent: rating.drawPercent,
    }
  })
  const countedGameSeats = ratings.reduce(
    (total, rating) => total + rating.games,
    0,
  )
  if (seenAliases.size !== aliases.size) {
    throw new TypeError("BayesElo ratings do not cover every policy alias.")
  }
  if (countedGameSeats !== input.input.completedGameCount * 2) {
    throw new TypeError(
      "BayesElo rating game counts do not match the completed input.",
    )
  }

  const anchoredRating = ratings.find(
    ({ alias }) => alias === input.bridgeOffset.alias,
  )
  if (anchoredRating?.estimateElo !== input.bridgeOffset.anchorElo) {
    throw new TypeError("BayesElo did not apply the requested bridge offset.")
  }

  return {
    schemaVersion: BAYES_ELO_RATING_EVIDENCE_SCHEMA_VERSION,
    tool: BAYES_ELO_EXECUTABLE_IDENTITY,
    observedVersion: BAYES_ELO_EXECUTABLE_IDENTITY.version,
    planId: input.input.planId,
    variant: "standard",
    inputSha256: input.input.inputSha256,
    pgnSha256: input.input.pgnSha256,
    completedPairCount: input.input.completedPairCount,
    completedGameCount: input.input.completedGameCount,
    excludedPairCount: input.input.excludedPairCount,
    bridgeOffset: input.bridgeOffset,
    ratings,
    likelihoodOfSuperiority: parseLikelihoodMatrix(
      lines,
      parsedRatings,
      aliases,
    ),
    transcript: {
      stdout: input.stdout,
      stderr: input.stderr,
      stdoutSha256: sha256Text(input.stdout),
      stderrSha256: sha256Text(input.stderr),
    },
  }
}
