import { describe, expect, it } from "vitest"
import loadCatalog from "@mapachess/localization/catalog"
import {
  TIME_CONTROL_PRESETS,
  timeCategory,
  timeControlLabel,
} from "../src/timeControl.js"

describe("localized time controls", () => {
  it.each([
    [
      "en",
      [
        "Untimed",
        "Bullet · 1+0",
        "Bullet · 2+1",
        "Blitz · 3+2",
        "Blitz · 5+0",
        "Rapid · 10+0",
      ],
    ],
    [
      "es-419",
      [
        "Sin reloj",
        "Bala · 1+0",
        "Bala · 2+1",
        "Relámpago · 3+2",
        "Relámpago · 5+0",
        "Rápido · 10+0",
      ],
    ],
  ] as const)(
    "keeps exact presets distinct from aggregate categories in %s",
    (locale, expected) => {
      const copy = loadCatalog(locale).gameplay.clock
      expect(
        TIME_CONTROL_PRESETS.map(({ control }) =>
          timeControlLabel(control, copy),
        ),
      ).toEqual(expected)
      expect(timeCategory(TIME_CONTROL_PRESETS[1].control)).toBe(
        timeCategory(TIME_CONTROL_PRESETS[2].control),
      )
    },
  )

  it("does not round an accepted non-preset control into a different duration", () => {
    expect(
      timeControlLabel(
        { type: "fischer", baseSeconds: 90, incrementSeconds: 3 },
        loadCatalog("en").gameplay.clock,
      ),
    ).toBe("Blitz · 1.5+3")
  })

  it.each([
    [
      "en",
      1,
      0,
      "1 minute per player. No time is added after moves. Hints do not pause the clock.",
    ],
    [
      "en",
      2,
      1,
      "2 minutes per player. Each move adds 1 second to that player’s clock. Hints do not pause the clock.",
    ],
    [
      "en",
      3,
      2,
      "3 minutes per player. Each move adds 2 seconds to that player’s clock. Hints do not pause the clock.",
    ],
    [
      "es-419",
      1,
      0,
      "1 minuto por jugador. No se añade tiempo después de las jugadas. Las pistas no pausan el reloj.",
    ],
    [
      "es-419",
      2,
      1,
      "2 minutos por jugador. Cada jugada añade 1 segundo al reloj de quien mueve. Las pistas no pausan el reloj.",
    ],
    [
      "es-419",
      3,
      2,
      "3 minutos por jugador. Cada jugada añade 2 segundos al reloj de quien mueve. Las pistas no pausan el reloj.",
    ],
  ] as const)(
    "explains %s %i+%i without losing zero or singular meaning",
    (locale, minutes, increment, expected) => {
      expect(
        loadCatalog(locale).gameplay.clock.explanation(minutes, increment),
      ).toBe(expected)
    },
  )
})
