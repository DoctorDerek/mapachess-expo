import cx from "classix"
import { View } from "react-native"
import { controllerPrompt } from "@mapachess/match-presentation/input-prompts"
import {
  keyboardBindingLabel,
  type PlayerInputAction,
} from "@mapachess/match/player-input"
import NativeImage from "../presentation/NativeImage"
import NativeText from "../presentation/NativeText"
import { useNativeInput } from "./NativeInputProvider"

export default function NativeInputPrompt({
  action,
  textClassName,
}: Readonly<{ action: PlayerInputAction; textClassName?: string }>) {
  const input = useNativeInput()
  if (
    input === null ||
    input.device.method === "touch" ||
    input.device.method === "pointer"
  )
    return null
  if (input.device.method === "keyboard")
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <NativeText accessible={false} className={cx("text-xs", textClassName)}>
          {keyboardBindingLabel(input.bindings.keyboard[action])}
        </NativeText>
      </View>
    )
  if (input.device.method !== "controller") return null
  const control = input.bindings.controller[action][0]
  return control === undefined ? null : (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <NativeImage
        sourceId={controllerPrompt(input.device.family, control).source}
        className="size-6"
      />
    </View>
  )
}
