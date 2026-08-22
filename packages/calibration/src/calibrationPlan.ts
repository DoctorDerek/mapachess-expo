import { createHash } from "node:crypto"
import createDeterministicRandom, {
  deriveCalibrationSeed,
  parseCalibrationRootSeed,
  shuffleDeterministically,
  type CalibrationRootSeed,
  type CalibrationSeed,
} from "./deterministicRandom.js"
import fingerprintOpponentPolicy, {
  serializeOpponentPolicy,
  type CalibrationVariant,
  type OpponentPolicy,
  type OpponentPolicyFingerprint,
} from "./opponentPolicy.js"

export const CALIBRATION_PLAN_SCHEMA_VERSION = 1 as const

const PLAN_ID_NAMESPACE = "mapachess.calibration-plan/v1"
const PAIR_ID_NAMESPACE = "mapachess.calibration-pair/v1"
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

declare const calibrationGameIdBrand: unique symbol
declare const calibrationPairIdBrand: unique symbol
declare const calibrationPlanIdBrand: unique symbol

export type CalibrationGameId = string & {
  readonly [calibrationGameIdBrand]: true
}
export type CalibrationPairId = `sha256:${string}` & {
  readonly [calibrationPairIdBrand]: true
}
export type CalibrationPlanId = `sha256:${string}` & {
  readonly [calibrationPlanIdBrand]: true
}

export type CalibrationOpening = Readonly<{
  fen: string
  id: string
}>

export type CalibrationEdge = Readonly<{
  id: string
  pairsPerOpening: number
  policyA: OpponentPolicy
  policyB: OpponentPolicy
}>

export type CalibrationPlanInput = Readonly<{
  schemaVersion: typeof CALIBRATION_PLAN_SCHEMA_VERSION
  edges: readonly CalibrationEdge[]
  openings: readonly CalibrationOpening[]
  seed: number
  variant: CalibrationVariant
}>

export type CalibrationPolicyRecord = Readonly<{
  fingerprint: OpponentPolicyFingerprint
  serializedPolicy: string
}>

export type CalibrationSeat = Readonly<{
  policyFingerprint: OpponentPolicyFingerprint
  randomSeed: CalibrationSeed
}>

export type CalibrationGame = Readonly<{
  edgeId: string
  fen: string
  gameId: CalibrationGameId
  gameInPair: 1 | 2
  openingId: string
  pairId: CalibrationPairId
  variant: CalibrationVariant
  black: CalibrationSeat
  white: CalibrationSeat
}>

export type CalibrationPlan = Readonly<{
  schemaVersion: typeof CALIBRATION_PLAN_SCHEMA_VERSION
  games: readonly CalibrationGame[]
  planId: CalibrationPlanId
  policies: readonly CalibrationPolicyRecord[]
  seed: CalibrationRootSeed
  variant: CalibrationVariant
}>

type NormalizedPolicy = Readonly<{
  fingerprint: OpponentPolicyFingerprint
  serializedPolicy: string
}>

type NormalizedEdge = Readonly<{
  id: string
  pairsPerOpening: number
  firstPolicy: NormalizedPolicy
  secondPolicy: NormalizedPolicy
}>

type NormalizedInput = Readonly<{
  edges: readonly NormalizedEdge[]
  openings: readonly CalibrationOpening[]
  seed: CalibrationRootSeed
  variant: CalibrationVariant
}>

type PairBlock = Readonly<{
  edge: NormalizedEdge
  opening: CalibrationOpening
  pairId: CalibrationPairId
}>

function assertStableText(value: string, label: string): void {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${label} must be nonempty, trimmed, and free of control characters.`,
    )
  }
}

function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
}

function compareText(left: string, right: string): number {
  return Number(left > right) - Number(left < right)
}

function sha256Id(namespace: string, payload: string): `sha256:${string}` {
  const digest = createHash("sha256")
    .update(JSON.stringify([namespace, payload]), "utf8")
    .digest("hex")

  return `sha256:${digest}`
}

function normalizePolicy(policy: OpponentPolicy): NormalizedPolicy {
  return {
    fingerprint: fingerprintOpponentPolicy(policy),
    serializedPolicy: serializeOpponentPolicy(policy),
  }
}

function normalizeInput(input: CalibrationPlanInput): NormalizedInput {
  if (input.schemaVersion !== CALIBRATION_PLAN_SCHEMA_VERSION) {
    throw new TypeError(
      `schemaVersion must be ${CALIBRATION_PLAN_SCHEMA_VERSION}.`,
    )
  }

  if (input.variant !== "standard" && input.variant !== "chess960") {
    throw new TypeError('variant must be "standard" or "chess960".')
  }

  const seed = parseCalibrationRootSeed(input.seed, "plan seed")

  if (input.openings.length === 0) {
    throw new TypeError("A calibration plan requires at least one opening.")
  }

  const openingIds = new Set<string>()
  const openings = input.openings
    .map((opening, index): CalibrationOpening => {
      assertStableText(opening.id, `openings[${index}].id`)
      assertStableText(opening.fen, `openings[${index}].fen`)

      if (openingIds.has(opening.id)) {
        throw new TypeError(`Opening id must be unique: ${opening.id}.`)
      }

      openingIds.add(opening.id)
      return { id: opening.id, fen: opening.fen }
    })
    .sort((left, right) => compareText(left.id, right.id))

  if (input.edges.length === 0) {
    throw new TypeError("A calibration plan requires at least one edge.")
  }

  const edgeIds = new Set<string>()
  let totalPairs = 0
  const edges = input.edges
    .map((edge, index): NormalizedEdge => {
      assertStableText(edge.id, `edges[${index}].id`)
      assertPositiveSafeInteger(
        edge.pairsPerOpening,
        `edges[${index}].pairsPerOpening`,
      )

      if (edgeIds.has(edge.id)) {
        throw new TypeError(`Edge id must be unique: ${edge.id}.`)
      }

      edgeIds.add(edge.id)
      const policyA = normalizePolicy(edge.policyA)
      const policyB = normalizePolicy(edge.policyB)

      if (
        edge.policyA.variant !== input.variant ||
        edge.policyB.variant !== input.variant
      ) {
        throw new TypeError(
          `Edge ${edge.id} policies must use the plan variant ${input.variant}.`,
        )
      }

      if (policyA.fingerprint === policyB.fingerprint) {
        throw new TypeError(
          `Edge ${edge.id} must compare two distinct policies.`,
        )
      }

      const edgePairCount = edge.pairsPerOpening * openings.length

      if (!Number.isSafeInteger(edgePairCount)) {
        throw new TypeError("Calibration plan game count exceeds safe limits.")
      }

      totalPairs += edgePairCount

      if (!Number.isSafeInteger(totalPairs)) {
        throw new TypeError("Calibration plan game count exceeds safe limits.")
      }

      const [firstPolicy, secondPolicy] =
        policyA.fingerprint < policyB.fingerprint
          ? [policyA, policyB]
          : [policyB, policyA]

      return {
        id: edge.id,
        pairsPerOpening: edge.pairsPerOpening,
        firstPolicy,
        secondPolicy,
      }
    })
    .sort((left, right) => compareText(left.id, right.id))

  if (!Number.isSafeInteger(totalPairs * 2)) {
    throw new TypeError("Calibration plan game count exceeds safe limits.")
  }

  return { edges, openings, seed, variant: input.variant }
}

function serializeNormalizedInput(input: NormalizedInput): string {
  return JSON.stringify({
    namespace: PLAN_ID_NAMESPACE,
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    seed: input.seed,
    variant: input.variant,
    openings: input.openings.map((opening) => ({
      id: opening.id,
      fen: opening.fen,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      pairsPerOpening: edge.pairsPerOpening,
      firstPolicy: edge.firstPolicy.serializedPolicy,
      secondPolicy: edge.secondPolicy.serializedPolicy,
    })),
  })
}

function createPairBlocks(
  input: NormalizedInput,
  planId: CalibrationPlanId,
): readonly PairBlock[] {
  const pairBlocks: PairBlock[] = []

  for (const edge of input.edges) {
    for (const opening of input.openings) {
      for (
        let repetitionIndex = 0;
        repetitionIndex < edge.pairsPerOpening;
        repetitionIndex++
      ) {
        pairBlocks.push({
          edge,
          opening,
          pairId: sha256Id(
            PAIR_ID_NAMESPACE,
            JSON.stringify([planId, edge.id, opening.id, repetitionIndex]),
          ) as CalibrationPairId,
        })
      }
    }
  }

  return shuffleDeterministically(
    pairBlocks,
    deriveCalibrationSeed(input.seed, planId, "pair-order"),
  )
}

function createSeat(
  policy: NormalizedPolicy,
  randomSeed: CalibrationSeed,
): CalibrationSeat {
  return {
    policyFingerprint: policy.fingerprint,
    randomSeed,
  }
}

function createGames(
  input: NormalizedInput,
  pairBlocks: readonly PairBlock[],
): readonly CalibrationGame[] {
  return pairBlocks.flatMap(
    (pair): readonly [CalibrationGame, CalibrationGame] => {
      const firstSeed = deriveCalibrationSeed(
        input.seed,
        pair.pairId,
        pair.edge.firstPolicy.fingerprint,
      )
      const secondSeed = deriveCalibrationSeed(
        input.seed,
        pair.pairId,
        pair.edge.secondPolicy.fingerprint,
      )
      const orientationRandom = createDeterministicRandom(
        deriveCalibrationSeed(
          input.seed,
          pair.pairId,
          "first-game-orientation",
        ),
      )
      const firstPolicyStartsWhite = orientationRandom.nextIndex(2) === 0
      const firstSeat = createSeat(pair.edge.firstPolicy, firstSeed)
      const secondSeat = createSeat(pair.edge.secondPolicy, secondSeed)
      const common = {
        edgeId: pair.edge.id,
        fen: pair.opening.fen,
        openingId: pair.opening.id,
        pairId: pair.pairId,
        variant: input.variant,
      }

      return [
        {
          ...common,
          gameId: `${pair.pairId}/game/1` as CalibrationGameId,
          gameInPair: 1,
          white: firstPolicyStartsWhite ? firstSeat : secondSeat,
          black: firstPolicyStartsWhite ? secondSeat : firstSeat,
        },
        {
          ...common,
          gameId: `${pair.pairId}/game/2` as CalibrationGameId,
          gameInPair: 2,
          white: firstPolicyStartsWhite ? secondSeat : firstSeat,
          black: firstPolicyStartsWhite ? firstSeat : secondSeat,
        },
      ]
    },
  )
}

export default function createCalibrationPlan(
  input: CalibrationPlanInput,
): CalibrationPlan {
  const normalizedInput = normalizeInput(input)
  const planId = sha256Id(
    PLAN_ID_NAMESPACE,
    serializeNormalizedInput(normalizedInput),
  ) as CalibrationPlanId
  const pairBlocks = createPairBlocks(normalizedInput, planId)
  const policyRecords = new Map<OpponentPolicyFingerprint, string>()

  for (const edge of normalizedInput.edges) {
    policyRecords.set(
      edge.firstPolicy.fingerprint,
      edge.firstPolicy.serializedPolicy,
    )
    policyRecords.set(
      edge.secondPolicy.fingerprint,
      edge.secondPolicy.serializedPolicy,
    )
  }

  const policies = [...policyRecords.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([fingerprint, serializedPolicy]) => ({
      fingerprint,
      serializedPolicy,
    }))

  return {
    schemaVersion: CALIBRATION_PLAN_SCHEMA_VERSION,
    planId,
    seed: normalizedInput.seed,
    variant: normalizedInput.variant,
    policies,
    games: createGames(normalizedInput, pairBlocks),
  }
}
