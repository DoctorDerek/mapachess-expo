import { useRef, useState } from "react"
import { controllerPrompt } from "@mapachess/match-presentation/input-prompts"
import DEFAULT_PLAYER_INPUT_BINDINGS, {
  changePlayerInputBinding,
  CONTROLLER_CONTROL_LABELS,
  CONTROLLER_CONTROLS,
  isBindableKeyboardCode,
  keyboardBindingLabel,
  PLAYER_INPUT_ACTIONS,
  PLAYER_INPUT_LABELS,
  samePlayerInputBindings,
  type BindingChange,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import MapachessButton from "../presentation/MapachessButton"
import MapachessDialog from "../presentation/MapachessDialog"
import { usePlayerInput, usePlayerInputScope } from "./PlayerInputProvider"

function BindingEditor({
  bindings,
  onCancel,
  onSave,
}: Readonly<{
  bindings: PlayerInputBindings
  onCancel: () => void
  onSave: (bindings: PlayerInputBindings) => void
}>) {
  const [draft, setDraft] = useState(bindings)
  const [device, setDevice] = useState<"controller" | "keyboard">("controller")
  const [editing, setEditing] = useState<PlayerInputAction | null>(null)
  const [slot, setSlot] = useState<0 | 1>(0)
  const [conflict, setConflict] = useState<ReturnType<
    typeof changePlayerInputBinding
  > | null>(null)
  const input = usePlayerInput()
  const family =
    input?.device.method === "controller" ? input.device.family : "generic"
  const root = useRef<HTMLElement>(null)
  usePlayerInputScope({
    root,
    handle: (action) => {
      if (action !== "cancel") return false
      onCancel()
      return true
    },
  })
  const closeChoice = (): void => {
    setConflict(null)
    setEditing(null)
    setSlot(0)
  }
  const choose = (change: BindingChange): void => {
    const changed = changePlayerInputBinding(draft, change)
    if (changed.displaced !== null || changed.bindings === null)
      setConflict(changed)
    else {
      setDraft(changed.bindings)
      closeChoice()
    }
  }
  return (
    <section
      ref={root}
      data-player-input-layer="bindings"
      className="border-mapachito-violet mt-3 rounded-xl border-2 p-3 [&_button]:scroll-mt-20"
      aria-label="Controls"
    >
      <div className="flex flex-wrap gap-3">
        {(["controller", "keyboard"] as const).map((option) => (
          <MapachessButton
            autoFocus={option === "controller"}
            key={option}
            variant="secondary"
            aria-pressed={device === option}
            onClick={() => setDevice(option)}
          >
            {option === "controller" ? "Controller" : "Keyboard"}
          </MapachessButton>
        ))}
      </div>
      <p className="mt-3 text-sm">
        Changes apply only after Save succeeds. Tab and platform shortcuts keep
        their normal behavior.
      </p>
      <div className="mt-3 grid gap-2">
        {PLAYER_INPUT_ACTIONS.map((action) => (
          <div
            key={action}
            className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] items-center gap-3"
          >
            <span id={`binding-${action}`} className="font-bold">
              {PLAYER_INPUT_LABELS[action]}
            </span>
            <MapachessButton
              variant="secondary"
              aria-labelledby={`binding-${action} binding-value-${action}`}
              onClick={() => setEditing(action)}
            >
              <span
                id={`binding-value-${action}`}
                className="flex flex-wrap items-center justify-center gap-2 text-sm"
              >
                {device === "keyboard"
                  ? keyboardBindingLabel(draft.keyboard[action])
                  : draft.controller[action].length === 0
                    ? "Via focused control"
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
                            {prompt.label}
                          </span>
                        )
                      })}
              </span>
            </MapachessButton>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <MapachessButton
          variant="secondary"
          onClick={() => setDraft(DEFAULT_PLAYER_INPUT_BINDINGS)}
        >
          Restore defaults
        </MapachessButton>
        <MapachessButton variant="secondary" onClick={onCancel}>
          Cancel
        </MapachessButton>
        <MapachessButton
          disabled={samePlayerInputBindings(draft, bindings)}
          onClick={() => onSave(draft)}
        >
          Save controls
        </MapachessButton>
      </div>
      {editing === null ? null : (
        <MapachessDialog
          label={`Change ${PLAYER_INPUT_LABELS[editing]} binding`}
          onClose={closeChoice}
        >
          <h3 className="text-xl font-black">{PLAYER_INPUT_LABELS[editing]}</h3>
          {conflict !== null ? (
            <>
              <p className="my-4" role="status">
                {conflict.bindings === null
                  ? "That change would leave a required action unbound. Choose another control."
                  : `Already assigned to ${conflict.displaced === null ? "another action" : PLAYER_INPUT_LABELS[conflict.displaced]}. Swap the two bindings?`}
              </p>
              <div className="flex gap-3">
                <MapachessButton
                  autoFocus
                  variant="secondary"
                  onClick={() => setConflict(null)}
                >
                  Cancel swap
                </MapachessButton>
                {conflict.bindings === null ? null : (
                  <MapachessButton
                    onClick={() => {
                      if (conflict.bindings !== null)
                        setDraft(conflict.bindings)
                      closeChoice()
                    }}
                  >
                    Swap bindings
                  </MapachessButton>
                )}
              </div>
            </>
          ) : device === "controller" ? (
            <>
              <p className="my-3">
                Choose the physical control. Your saved controls still navigate
                this chooser.
              </p>
              <div className="mb-3 flex flex-wrap gap-3">
                {([0, 1] as const).map((index) => {
                  const current = draft.controller[editing][index]
                  return (
                    <MapachessButton
                      key={index}
                      variant="secondary"
                      disabled={
                        index === 1 && draft.controller[editing].length === 0
                      }
                      aria-pressed={slot === index}
                      onClick={() => setSlot(index)}
                    >
                      {index === 0 ? "Primary" : "Alternate"}:{" "}
                      {current === undefined
                        ? "Not assigned"
                        : CONTROLLER_CONTROL_LABELS[current]}
                    </MapachessButton>
                  )
                })}
                {draft.controller[editing][slot] === undefined ||
                (draft.controller[editing].length === 1 &&
                  editing !== "undo" &&
                  editing !== "redo") ? null : (
                  <MapachessButton
                    variant="secondary"
                    onClick={() =>
                      choose({ device, action: editing, slot, control: null })
                    }
                  >
                    Remove binding
                  </MapachessButton>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {CONTROLLER_CONTROLS.map((control, index) => {
                  const prompt = controllerPrompt(family, control)
                  return (
                    <MapachessButton
                      key={control}
                      autoFocus={index === 0}
                      variant="secondary"
                      onClick={() =>
                        choose({ device, action: editing, slot, control })
                      }
                    >
                      <img
                        alt=""
                        src={prompt.source}
                        width={32}
                        height={32}
                        className="bg-mapachito-charcoal mx-auto size-8 rounded"
                      />
                      {CONTROLLER_CONTROL_LABELS[control]}
                    </MapachessButton>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="my-4">
              <MapachessButton
                autoFocus
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
                  choose({ device, action: editing, code: event.code })
                }}
              >
                Press a key
              </MapachessButton>
              <p className="my-3">
                Escape closes without changes. To bind Escape explicitly, use
                this control:
              </p>
              <MapachessButton
                variant="secondary"
                onClick={() =>
                  choose({ device, action: editing, code: "Escape" })
                }
              >
                Use Escape
              </MapachessButton>
            </div>
          )}
          <MapachessButton
            className="mt-4"
            variant="secondary"
            onClick={closeChoice}
          >
            Cancel binding change
          </MapachessButton>
        </MapachessDialog>
      )}
    </section>
  )
}

export default function InputBindingSettings({
  bindings,
  disabled,
  onSave,
}: Readonly<{
  bindings: PlayerInputBindings
  disabled: boolean
  onSave: (bindings: PlayerInputBindings) => void
}>) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = (): void => {
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div className="mt-7">
      <MapachessButton
        ref={trigger}
        variant="secondary"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        Controls
      </MapachessButton>
      {open ? (
        <BindingEditor
          bindings={bindings}
          onCancel={close}
          onSave={(next) => {
            onSave(next)
            close()
          }}
        />
      ) : null}
    </div>
  )
}
