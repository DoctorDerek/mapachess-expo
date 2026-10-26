import { useRef, useState } from "react"
import { controllerPrompt } from "@mapachess/match-presentation/input-prompts"
import type {
  MatchNavigationCommands,
  MatchNavigationOverlay,
} from "@mapachess/match/match-navigation"
import DEFAULT_PLAYER_INPUT_BINDINGS, {
  changePlayerInputBinding,
  CONTROLLER_CONTROLS,
  isBindableKeyboardCode,
  keyboardBindingLabel,
  PLAYER_INPUT_ACTIONS,
  samePlayerInputBindings,
  type BindingChange,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { useMapachessCopy } from "../profile/MapachessLocaleProvider"
import SettingsView from "../profile/SettingsView"
import { usePlayerInput } from "./PlayerInputProvider"

function BindingChoice({
  action,
  device,
  draft,
  setDraft,
  onClose,
}: Readonly<{
  action: PlayerInputAction
  device: "controller" | "keyboard"
  draft: PlayerInputBindings
  setDraft: (bindings: PlayerInputBindings) => void
  onClose: () => void
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.inputBindingSettings
  const [slot, setSlot] = useState<0 | 1>(0)
  const keyboardCapture = useRef<HTMLButtonElement>(null)
  const [conflict, setConflict] = useState<ReturnType<
    typeof changePlayerInputBinding
  > | null>(null)
  const input = usePlayerInput()
  const family =
    input?.device.method === "controller" ? input.device.family : "generic"
  const choose = (change: BindingChange): void => {
    const changed = changePlayerInputBinding(draft, change)
    if (changed.displaced !== null || changed.bindings === null)
      setConflict(changed)
    else {
      setDraft(changed.bindings)
      onClose()
    }
  }
  return (
    <MapachessDialog
      label={copy.controls.changeBinding(copy.shared.inputActions[action])}
      onClose={onClose}
      fixedContent
    >
      <SettingsView
        title={copy.shared.inputActions[action]}
        initialFocus={keyboardCapture}
        closeLabel={
          conflict === null ? messages.cancelBindingChange : messages.cancelSwap
        }
        onClose={conflict === null ? onClose : () => setConflict(null)}
        actions={
          conflict?.bindings ? (
            <MapachessButton
              onClick={() => {
                if (conflict.bindings !== null) setDraft(conflict.bindings)
                onClose()
              }}
            >
              {messages.swapBindings}
            </MapachessButton>
          ) : null
        }
      >
        {conflict !== null ? (
          <p className="my-4" role="status">
            {conflict.bindings === null
              ? copy.controls.requiredAction
              : copy.controls.swapQuestion(
                  conflict.displaced === null
                    ? null
                    : copy.shared.inputActions[conflict.displaced],
                )}
          </p>
        ) : device === "controller" ? (
          <>
            <p className="my-3">
              {messages.chooseThePhysicalControlYourSavedControls}
            </p>
            <div className="mb-3 flex flex-wrap gap-3">
              {([0, 1] as const).map((index) => {
                const current = draft.controller[action][index]
                return (
                  <MapachessButton
                    key={index}
                    variant="secondary"
                    disabled={
                      index === 1 && draft.controller[action].length === 0
                    }
                    aria-pressed={slot === index}
                    onClick={() => setSlot(index)}
                  >
                    {copy.controls[index === 0 ? "primary" : "alternate"](
                      current === undefined
                        ? undefined
                        : copy.shared.controllerControls[current],
                    )}
                  </MapachessButton>
                )
              })}
              {draft.controller[action][slot] === undefined ||
              (draft.controller[action].length === 1 &&
                action !== "undo" &&
                action !== "redo") ? null : (
                <MapachessButton
                  variant="secondary"
                  onClick={() =>
                    choose({ device, action, slot, control: null })
                  }
                >
                  {messages.removeBinding}
                </MapachessButton>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3">
              {CONTROLLER_CONTROLS.map((control, index) => {
                const prompt = controllerPrompt(family, control)
                return (
                  <MapachessButton
                    key={control}
                    autoFocus={index === 0}
                    variant="secondary"
                    onClick={() => choose({ device, action, slot, control })}
                  >
                    <img
                      alt=""
                      src={prompt.source}
                      width={32}
                      height={32}
                      className="bg-mapachito-charcoal mx-auto size-8 rounded"
                    />
                    {copy.shared.controllerControls[control]}
                  </MapachessButton>
                )
              })}
            </div>
          </>
        ) : (
          <div className="my-4">
            <MapachessButton
              autoFocus
              ref={keyboardCapture}
              variant="secondary"
              onKeyDown={(event) => {
                if (event.code === "Escape") return
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.altKey ||
                  event.repeat ||
                  !isBindableKeyboardCode(event.code)
                )
                  return
                event.preventDefault()
                event.stopPropagation()
                choose({ device, action, code: event.code })
              }}
            >
              {messages.pressAKey}
            </MapachessButton>
            <p className="my-3">
              {messages.escapeClosesWithoutChangesToBindEscape}
            </p>
            <MapachessButton
              variant="secondary"
              onClick={() => choose({ device, action, code: "Escape" })}
            >
              {messages.useEscape}
            </MapachessButton>
          </div>
        )}
      </SettingsView>
    </MapachessDialog>
  )
}

function BindingEditor({
  bindings,
  overlays,
  navigation,
  onSave,
}: Readonly<{
  bindings: PlayerInputBindings
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
  onSave: (bindings: PlayerInputBindings) => void
}>) {
  const copy = useMapachessCopy()
  const messages = copy.interface.inputBindingSettings
  const [draft, setDraft] = useState(bindings)
  const [device, setDevice] = useState<"controller" | "keyboard">("controller")
  const editing = PLAYER_INPUT_ACTIONS.find(
    (action) => overlays.at(-1) === `control-binding-${action}`,
  )
  const input = usePlayerInput()
  const family =
    input?.device.method === "controller" ? input.device.family : "generic"
  return (
    <MapachessDialog
      label={messages.controls}
      onClose={navigation.back}
      fixedContent
    >
      <SettingsView
        title={messages.controls}
        closeLabel={messages.cancel}
        onClose={navigation.back}
        focusHeading
        actions={
          <MapachessButton
            disabled={samePlayerInputBindings(draft, bindings)}
            onClick={() => {
              onSave(draft)
              navigation.back()
            }}
          >
            {messages.saveControls}
          </MapachessButton>
        }
      >
        <div className="flex flex-wrap gap-3">
          {(["controller", "keyboard"] as const).map((option) => (
            <MapachessButton
              key={option}
              variant="secondary"
              aria-pressed={device === option}
              onClick={() => setDevice(option)}
            >
              {copy.controls.devices[option]}
            </MapachessButton>
          ))}
        </div>
        <p className="mt-3 text-sm">
          {messages.changesApplyOnlyAfterSaveSucceedsTab}
        </p>
        <div className="mt-3 grid gap-2">
          {PLAYER_INPUT_ACTIONS.map((action) => (
            <div key={action} className="flex flex-wrap items-center gap-2">
              <span
                id={`binding-${action}`}
                className="min-w-0 flex-1 basis-20 font-bold"
              >
                {copy.shared.inputActions[action]}
              </span>
              <MapachessButton
                variant="secondary"
                className="min-w-0 flex-2 basis-36"
                aria-labelledby={`binding-${action} binding-value-${action}`}
                onClick={() => navigation.open(`control-binding-${action}`)}
              >
                <span
                  id={`binding-value-${action}`}
                  className="flex flex-wrap items-center justify-center gap-2 text-sm"
                >
                  {device === "keyboard"
                    ? keyboardBindingLabel(
                        draft.keyboard[action],
                        copy.controls.keys,
                      )
                    : draft.controller[action].length === 0
                      ? copy.controls.focusedControl
                      : draft.controller[action].map((control) => {
                          const prompt = controllerPrompt(family, control)
                          return (
                            <span
                              key={control}
                              className="inline-flex items-center gap-1"
                            >
                              <img
                                alt=""
                                src={prompt.source}
                                width={28}
                                height={28}
                                className="bg-mapachito-charcoal size-7 rounded"
                              />
                              {copy.shared.controllerControls[control]}
                            </span>
                          )
                        })}
                </span>
              </MapachessButton>
            </div>
          ))}
        </div>

        <MapachessButton
          className="mt-4"
          variant="secondary"
          onClick={() => setDraft(DEFAULT_PLAYER_INPUT_BINDINGS)}
        >
          {messages.restoreDefaults}
        </MapachessButton>
      </SettingsView>
      {editing === undefined ? null : (
        <BindingChoice
          key={editing}
          action={editing}
          device={device}
          draft={draft}
          setDraft={setDraft}
          onClose={navigation.back}
        />
      )}
    </MapachessDialog>
  )
}

export default function InputBindingSettings({
  bindings,
  disabled,
  overlays,
  navigation,
  onSave,
}: Readonly<{
  bindings: PlayerInputBindings
  disabled: boolean
  overlays: readonly MatchNavigationOverlay[]
  navigation: MatchNavigationCommands
  onSave: (bindings: PlayerInputBindings) => void
}>) {
  const messages = useMapachessCopy().interface.inputBindingSettings
  return (
    <div className="mt-7">
      <MapachessButton
        variant="secondary"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => navigation.open("settings-controls")}
      >
        {messages.controls}
      </MapachessButton>
      {overlays.includes("settings-controls") ? (
        <BindingEditor
          bindings={bindings}
          overlays={overlays}
          navigation={navigation}
          onSave={onSave}
        />
      ) : null}
    </div>
  )
}
