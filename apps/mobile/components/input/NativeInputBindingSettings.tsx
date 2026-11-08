import { useEffect, useState } from "react"
import { TextInput, View } from "react-native"
import { controllerPrompt } from "@mapachess/match-presentation/input-prompts"
import {
  changePlayerInputBinding,
  CONTROLLER_BUTTONS,
  CONTROLLER_CONTROLS,
  DEFAULT_PLAYER_INPUT_BINDINGS,
  isBindableKeyboardCode,
  keyboardBindingLabel,
  PLAYER_INPUT_ACTIONS,
  type BindingChange,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import NativeButton from "../presentation/NativeButton"
import NativeImage from "../presentation/NativeImage"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import { useNativeInput } from "./NativeInputProvider"

export default function NativeInputBindingSettings({
  bindings,
  onCancel,
  onSave,
}: Readonly<{
  bindings: PlayerInputBindings
  onCancel: () => void
  onSave: (bindings: PlayerInputBindings) => void
}>) {
  const { copy } = useNativeLocale()
  const input = useNativeInput()
  const [draft, setDraft] = useState(bindings)
  const [editing, setEditing] = useState<Readonly<{
    action: PlayerInputAction
    device: "keyboard" | "controller"
    slot: 0 | 1
  }> | null>(null)
  const [code, setCode] = useState("")
  const [invalid, setInvalid] = useState(false)
  const [pending, setPending] = useState<ReturnType<
    typeof changePlayerInputBinding
  > | null>(null)
  const cancel = () =>
    pending !== null
      ? setPending(null)
      : editing !== null
        ? setEditing(null)
        : onCancel()
  const change = (change: BindingChange): void => {
    const next = changePlayerInputBinding(draft, change)
    setInvalid(next.bindings === null)
    if (next.bindings === null) return
    if (next.displaced !== null) setPending(next)
    else {
      setDraft(next.bindings)
      setEditing(null)
    }
  }
  useEffect(() => {
    if (editing === null || pending !== null || input === null) return
    let armed = false
    return input.capture((event) => {
      if (event.kind === "keyboard" && event.pressed) {
        if (event.code === "Escape") {
          cancel()
          return true
        }
        if (editing.device === "keyboard") {
          change({
            device: "keyboard",
            action: editing.action,
            code: event.code,
          })
          return true
        }
      }
      if (event.kind === "controller" && editing.device === "controller") {
        const button = CONTROLLER_BUTTONS.find(
          (_, index) => (event.buttons[index] ?? 0) > 0.55,
        )
        const x = event.axes[0] ?? 0,
          y = event.axes[1] ?? 0
        const control =
          button ??
          (x < -0.55
            ? "stickLeft"
            : x > 0.55
              ? "stickRight"
              : y < -0.55
                ? "stickUp"
                : y > 0.55
                  ? "stickDown"
                  : undefined)
        if (control === undefined) armed = true
        if (armed && control !== undefined)
          change({
            device: "controller",
            action: editing.action,
            slot: editing.slot,
            control,
          })
        return true
      }
      return false
    })
  }, [input?.capture, editing, pending])
  return (
    <NativePanel
      title={copy.interface.inputBindingSettings.controls}
      onBack={cancel}
      actions={
        pending !== null ? (
          <View className="flex-row gap-2">
            <NativeButton
              variant="secondary"
              className="flex-1"
              onPress={() => setPending(null)}
            >
              {copy.interface.inputBindingSettings.cancelSwap}
            </NativeButton>
            <NativeButton
              className="flex-1"
              onPress={() => {
                if (pending.bindings !== null) setDraft(pending.bindings)
                setPending(null)
                setEditing(null)
              }}
            >
              {copy.interface.inputBindingSettings.swapBindings}
            </NativeButton>
          </View>
        ) : editing !== null ? (
          <NativeButton variant="secondary" onPress={cancel}>
            {copy.interface.inputBindingSettings.cancelBindingChange}
          </NativeButton>
        ) : (
          <View className="flex-row gap-2">
            <NativeButton
              variant="secondary"
              className="flex-1"
              onPress={onCancel}
            >
              {copy.setup.cancel}
            </NativeButton>
            <NativeButton className="flex-1" onPress={() => onSave(draft)}>
              {copy.interface.inputBindingSettings.saveControls}
            </NativeButton>
          </View>
        )
      }
    >
      {pending !== null ? (
        <NativeText>
          {copy.controls.swapQuestion(
            pending.displaced === null
              ? null
              : copy.shared.inputActions[pending.displaced],
          )}
        </NativeText>
      ) : editing !== null ? (
        <>
          <NativeText>{copy.shared.inputActions[editing.action]}</NativeText>
          {invalid ? (
            <NativeText accessibilityRole="alert">
              {copy.controls.requiredAction}
            </NativeText>
          ) : null}
          {editing.device === "controller" ? (
            <>
              {CONTROLLER_CONTROLS.map((control) => (
                <NativeButton
                  key={control}
                  variant="secondary"
                  onPress={() =>
                    change({
                      device: "controller",
                      action: editing.action,
                      slot: editing.slot,
                      control,
                    })
                  }
                >
                  <View className="flex-row items-center gap-3">
                    <NativeImage
                      sourceId={controllerPrompt("generic", control).source}
                      className="size-10"
                    />
                    <NativeText>
                      {copy.shared.controllerControls[control]}
                    </NativeText>
                  </View>
                </NativeButton>
              ))}
              <NativeButton
                variant="secondary"
                onPress={() =>
                  change({
                    device: "controller",
                    action: editing.action,
                    slot: editing.slot,
                    control: null,
                  })
                }
              >
                {copy.interface.inputBindingSettings.removeBinding}
              </NativeButton>
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel={
                  copy.interface.inputBindingSettings.pressAKey
                }
                className="bg-mapachito-surface font-native text-mapachito-white min-h-12 rounded-lg p-3"
                autoCapitalize="none"
                autoCorrect={false}
                value={code}
                onChangeText={setCode}
              />
              <NativeButton
                disabled={!isBindableKeyboardCode(code)}
                onPress={() =>
                  change({ device: "keyboard", action: editing.action, code })
                }
              >
                {copy.setup.accept}
              </NativeButton>
            </>
          )}
        </>
      ) : (
        <>
          <NativeText>
            {
              copy.interface.inputBindingSettings
                .changesApplyOnlyAfterSaveSucceedsTab
            }
          </NativeText>
          <NativeButton
            variant="secondary"
            onPress={() => setDraft(DEFAULT_PLAYER_INPUT_BINDINGS)}
          >
            {copy.interface.inputBindingSettings.restoreDefaults}
          </NativeButton>
          {PLAYER_INPUT_ACTIONS.map((action) => (
            <View
              key={action}
              className="bg-mapachito-surface gap-2 rounded-xl p-3"
            >
              <NativeText className="font-native text-lg">
                {copy.shared.inputActions[action]}
              </NativeText>
              <NativeButton
                variant="secondary"
                onPress={() => {
                  setCode(draft.keyboard[action])
                  setInvalid(false)
                  setEditing({ action, device: "keyboard", slot: 0 })
                }}
              >
                {copy.controls.devices.keyboard}:{" "}
                {keyboardBindingLabel(
                  draft.keyboard[action],
                  copy.controls.keys,
                )}
              </NativeButton>
              {([0, 1] as const).map((slot) => (
                <NativeButton
                  key={slot}
                  variant="secondary"
                  onPress={() => {
                    setInvalid(false)
                    setEditing({ action, device: "controller", slot })
                  }}
                >
                  {slot === 0
                    ? copy.controls.primary(
                        draft.controller[action][slot] === undefined
                          ? undefined
                          : copy.shared.controllerControls[
                              draft.controller[action][slot]
                            ],
                      )
                    : copy.controls.alternate(
                        draft.controller[action][slot] === undefined
                          ? undefined
                          : copy.shared.controllerControls[
                              draft.controller[action][slot]
                            ],
                      )}
                </NativeButton>
              ))}
            </View>
          ))}
        </>
      )}
    </NativePanel>
  )
}
