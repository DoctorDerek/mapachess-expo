import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import resolveOpponentPolicy from "@mapachess/gameplay/opponent-policy"
import resolveWebOpponentPolicy, {
  resolveWebChallengePolicy,
} from "./webOpponentPolicy"

it("uses the browser digest and forwards the retained policy to the shared owner", async () => {
  const sha256 = async (text: string) =>
    createHash("sha256").update(text).digest("hex")
  const expected = await resolveOpponentPolicy(
    "chicken-stockfish",
    "standard",
    sha256,
  )

  expect(
    await resolveWebOpponentPolicy("chicken-stockfish", "standard"),
  ).toEqual(expected)
  expect(
    await resolveWebChallengePolicy(
      "chicken-stockfish",
      "standard",
      expected.targetElo,
      expected.fingerprint,
    ),
  ).toEqual(expected)
})
