import type { MapachessCatalog } from "@mapachess/localization/catalog"

export const TIME_CATEGORIES = ["untimed", "bullet", "blitz", "rapid"] as const
export type TimeCategory = (typeof TIME_CATEGORIES)[number]

export type TimeControl =
  | Readonly<{ type: "untimed" }>
  | Readonly<{ type: "fischer"; baseSeconds: number; incrementSeconds: number }>

export const UNTIMED: TimeControl = Object.freeze({ type: "untimed" })
export const TIME_CONTROL_PRESETS = [
  { id: "untimed", control: UNTIMED },
  {
    id: "1+0",
    control: { type: "fischer", baseSeconds: 60, incrementSeconds: 0 },
  },
  {
    id: "2+1",
    control: { type: "fischer", baseSeconds: 120, incrementSeconds: 1 },
  },
  {
    id: "3+2",
    control: { type: "fischer", baseSeconds: 180, incrementSeconds: 2 },
  },
  {
    id: "5+0",
    control: { type: "fischer", baseSeconds: 300, incrementSeconds: 0 },
  },
  {
    id: "10+0",
    control: { type: "fischer", baseSeconds: 600, incrementSeconds: 0 },
  },
] as const satisfies readonly Readonly<{ id: string; control: TimeControl }>[]

export const timeCategory = (control: TimeControl): TimeCategory => {
  if (control.type === "untimed") return "untimed"
  const estimatedSeconds = control.baseSeconds + 40 * control.incrementSeconds
  return estimatedSeconds < 180
    ? "bullet"
    : estimatedSeconds < 600
      ? "blitz"
      : "rapid"
}

export const timeControlsEqual = (
  left: TimeControl,
  right: TimeControl,
): boolean =>
  left.type === "untimed"
    ? right.type === "untimed"
    : right.type === "fischer" &&
      left.baseSeconds === right.baseSeconds &&
      left.incrementSeconds === right.incrementSeconds

export const timeControlNotation = (control: TimeControl): string =>
  control.type === "untimed"
    ? ""
    : `${String(control.baseSeconds / 60)}+${String(control.incrementSeconds)}`
export const timeControlLabel = (
  control: TimeControl,
  copy: MapachessCatalog["gameplay"]["clock"],
): string =>
  control.type === "untimed"
    ? copy.category.untimed
    : copy.preset(
        copy.category[timeCategory(control)],
        timeControlNotation(control),
      )
