import type { InputDirection } from "./playerInput.js"

export type InputControlCenter<Value> = Readonly<{
  value: Value
  x: number
  y: number
}>

export default function directionalInputTarget<Value>(
  current: InputControlCenter<Value>,
  controls: readonly InputControlCenter<Value>[],
  direction: InputDirection,
): Value | undefined {
  const horizontal = direction === "left" || direction === "right"
  const sign = direction === "left" || direction === "up" ? -1 : 1
  return controls
    .flatMap((candidate) => {
      if (candidate.value === current.value) return []
      const dx = candidate.x - current.x,
        dy = candidate.y - current.y
      const forward = (horizontal ? dx : dy) * sign
      return forward <= 1
        ? []
        : [
            {
              value: candidate.value,
              distance: forward + Math.abs(horizontal ? dy : dx) * 3,
            },
          ]
    })
    .sort((a, b) => a.distance - b.distance)[0]?.value
}
