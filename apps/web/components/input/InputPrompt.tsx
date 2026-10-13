import type { ReactNode } from "react"
import { controllerPrompt } from "@mapachess/match-presentation/input-prompts"
import {
  keyboardBindingLabel,
  type PlayerInputAction,
} from "@mapachess/match/player-input"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import { usePlayerInput } from "./PlayerInputProvider"

export default function InputPrompt({
  action,
  fallback,
}: Readonly<{
  action: PlayerInputAction
  fallback?: ReactNode
}>) {
  const copy = useMapachessCopy()
  const input = usePlayerInput()
  const device = input?.device
  const control = input?.bindings.controller[action][0]
  const prompt =
    device?.method === "controller" && control !== undefined
      ? controllerPrompt(device.family, control)
      : null
  const key =
    device?.method === "keyboard" && input !== null
      ? keyboardBindingLabel(
          input.bindings.keyboard[action],
          copy.controls.keys,
        )
      : null
  return (
    <span className="inline-grid size-7 shrink-0 place-items-center align-middle text-xs leading-none">
      {prompt !== null ? (
        <img
          alt={copy.controls.prompt(
            control === undefined
              ? prompt.label
              : copy.shared.controllerControls[control],
            copy.shared.inputActions[action],
          )}
          src={prompt.source}
          width={28}
          height={28}
          className="bg-mapachito-charcoal size-7 rounded"
        />
      ) : key !== null ? (
        <kbd className="max-w-7 rounded border px-0.5 py-0.5 font-mono text-[0.55rem] leading-tight break-all">
          {key}
        </kbd>
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </span>
  )
}
