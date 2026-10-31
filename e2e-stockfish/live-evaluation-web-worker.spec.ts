import { expect, test } from "@playwright/test"
import type { EvaluationBrowserSample } from "../apps/web/stockfish-integration-harness/evaluationBrowserProof"
import { normalizeStockfishPositionEvaluation } from "../packages/evaluation/src/positionEvaluation"
import { POSITION_EVALUATION_NODE_LIMIT } from "../packages/evaluation/src/positionEvaluator"

test("streams real current-position scores without extra searches or changed terminal values", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const samples = await page.evaluate<readonly EvaluationBrowserSample[]>(() =>
    window.mapachessStockfishBrowserHarness.runEvaluationProof(),
  )
  expect(samples.map(({ variant, turn }) => `${variant}/${turn}`)).toEqual([
    "standard/white",
    "standard/black",
    "chess960/white",
    "chess960/black",
  ])
  for (const sample of samples) {
    expect(sample.queries).toHaveLength(1)
    expect(sample.queries[0]?.nodeLimit).toBe(POSITION_EVALUATION_NODE_LIMIT)
    expect(sample.refinements.length).toBeGreaterThan(0)
    for (const refinement of sample.refinements) {
      expect(refinement.finalResult).toBeNull()
      expect(refinement.value.requestId).toBe(sample.result.requestId)
      expect(refinement.value.positionFen).toBe(sample.result.positionFen)
      expect(refinement.elapsedMilliseconds).toBeLessThanOrEqual(
        sample.elapsedMilliseconds,
      )
    }
    const exact = sample.engineResult.latestExactPrincipalVariation
    expect(exact?.score).toBeDefined()
    if (exact?.score === undefined)
      throw new Error("Expected an exact principal score.")
    expect(sample.result.evaluation).toEqual(
      normalizeStockfishPositionEvaluation(sample.turn, exact.score),
    )
    expect(sample.result.bestMove).toBe(exact.moves[0])
  }
  testInfo.annotations.push({
    type: "live-evaluation-measurement",
    description: JSON.stringify(
      samples.map(({ variant, turn, refinements, elapsedMilliseconds }) => ({
        variant,
        turn,
        refinements: refinements.length,
        firstMilliseconds: refinements[0]?.elapsedMilliseconds,
        elapsedMilliseconds,
      })),
    ),
  })
  await expect.poll(() => page.workers().length).toBe(0)
  expect(errors).toEqual([])
})
