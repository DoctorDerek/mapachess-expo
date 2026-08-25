import { describe, expect, it } from "vitest"
import { getLighthouseCollectionConfiguration } from "@/scripts/lighthouse/lighthouseConfiguration"

describe("Lighthouse configuration", () => {
  it("uses the five-run mobile Production defaults", () => {
    expect(getLighthouseCollectionConfiguration({})).toEqual({
      numberOfRuns: 5,
      outputDirectory: "./lighthouse-results",
      targetUrl: "https://mapachess-expo-web.vercel.app/",
    })
  })

  it("accepts explicit local collection settings", () => {
    expect(
      getLighthouseCollectionConfiguration({
        LIGHTHOUSE_TARGET_URL: "http://127.0.0.1:3106",
        LIGHTHOUSE_NUMBER_OF_RUNS: "3",
        LIGHTHOUSE_OUTPUT_DIRECTORY: "./local-results",
      }),
    ).toEqual({
      numberOfRuns: 3,
      outputDirectory: "./local-results",
      targetUrl: "http://127.0.0.1:3106",
    })
  })

  it.each(["0", "-1", "invalid"])(
    "rejects an invalid run count of %s",
    (runCount) => {
      expect(() =>
        getLighthouseCollectionConfiguration({
          LIGHTHOUSE_NUMBER_OF_RUNS: runCount,
        }),
      ).toThrow("must be a positive integer")
    },
  )
})
