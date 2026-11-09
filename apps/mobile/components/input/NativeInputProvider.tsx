import cx from "classix"
import {
  NativeModule,
  requireNativeView,
  requireOptionalNativeModule,
} from "expo"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import {
  AccessibilityInfo,
  Platform,
  TextInput,
  View,
  type ViewProps,
} from "react-native"
import { withUniwind } from "uniwind"
import type { PlayerInputDevice } from "@mapachess/match-presentation/input-prompts"
import directionalInputTarget from "@mapachess/match/directional-input-target"
import {
  DEFAULT_PLAYER_INPUT_BINDINGS,
  isInputDirection,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import nativeApplicationActivity from "@/lib/gameplay/nativeApplicationActivity"
import createNativeInputDispatcher, {
  decodeNativeInputEvent,
  type NativeInputEvent,
} from "@/lib/input/nativeInput"
import useActorSnapshot from "@/lib/useActorSnapshot"

type Control = Readonly<{
  ref: RefObject<View | null>
  activate: () => void
  enabled: () => boolean
  handle?: (action: PlayerInputAction) => boolean
  reveal?: (ref: RefObject<View | null>) => void
}>
type Scope = {
  controls: Map<string, Control>
  focused: string | null
  listeners: Set<() => void>
  handle: (action: PlayerInputAction) => boolean
  enabled: () => boolean
  priority: number
}
type InputContext = Readonly<{
  device: PlayerInputDevice
  bindings: PlayerInputBindings
  register: (scope: Scope) => () => void
  receive: (event: unknown) => void
  touch: () => void
  capture: (listener: (event: NativeInputEvent) => boolean) => () => void
}>
const Input = createContext<InputContext | null>(null)
const Surface = createContext<Scope | null>(null)
export const InputReveal = createContext<Control["reveal"]>(undefined)
export const useNativeInput = () => useContext(Input)

function selectControl(scope: Scope, id: string): void {
  scope.focused = id
  scope.controls.get(id)?.ref.current?.focus()
  const control = scope.controls.get(id)
  if (control !== undefined) control.reveal?.(control.ref)
  for (const listener of scope.listeners) listener()
}

async function navigate(
  scope: Scope,
  action: PlayerInputAction,
  stillCurrent: () => boolean,
): Promise<void> {
  const controls = [...scope.controls].filter(([, control]) =>
    control.enabled(),
  )
  if (action !== "confirm" && !isInputDirection(action)) return
  const origin = scope.focused
  const rectangles = await Promise.all(
    controls.map(
      ([id, control]) =>
        new Promise<{ id: string; x: number; y: number } | null>((resolve) => {
          if (control.ref.current === null) resolve(null)
          else
            control.ref.current.measureInWindow((x, y, width, height) =>
              resolve(
                width > 0 && height > 0
                  ? { id, x: x + width / 2, y: y + height / 2 }
                  : null,
              ),
            )
        }),
    ),
  )
  if (!stillCurrent() || scope.focused !== origin) return
  const visible = controls.filter(
    ([id, control]) =>
      control.enabled() && rectangles.some((entry) => entry?.id === id),
  )
  const current = visible.find(([id]) => id === scope.focused)
  if (action === "confirm") {
    if (current === undefined) {
      if (visible[0] !== undefined) selectControl(scope, visible[0][0])
    } else current[1].activate()
    return
  }
  if (current === undefined) {
    const initial =
      action === "up" || action === "left" ? visible.at(-1) : visible[0]
    if (initial !== undefined) selectControl(scope, initial[0])
    return
  }
  const rect = rectangles.find((entry) => entry?.id === origin)
  if (rect === undefined || rect === null) return
  const candidate = directionalInputTarget(
    { value: rect.id, x: rect.x, y: rect.y },
    rectangles.flatMap((entry) =>
      entry === null ? [] : [{ value: entry.id, x: entry.x, y: entry.y }],
    ),
    action,
  )
  if (candidate !== undefined) selectControl(scope, candidate)
}

export function useNativeInputControl(
  ref: RefObject<View | null>,
  activate: () => void,
  enabled = true,
  handle?: Control["handle"],
  focusRequested = false,
): boolean {
  const scope = useContext(Surface)
  const reveal = useContext(InputReveal)
  const id = useId()
  const current = useRef({ activate, enabled, handle, reveal })
  current.current = { activate, enabled, handle, reveal }
  useEffect(() => {
    if (scope === null) return
    scope.controls.set(id, {
      ref,
      activate: () => current.current.activate(),
      enabled: () => current.current.enabled,
      handle: (action) => current.current.handle?.(action) ?? false,
      reveal: (target) => current.current.reveal?.(target),
    })
    return () => {
      scope.controls.delete(id)
      if (scope.focused === id) scope.focused = null
      for (const listener of scope.listeners) listener()
    }
  }, [scope, id, ref])
  useEffect(() => {
    if (!focusRequested || !enabled || scope === null || !scope.enabled())
      return
    selectControl(scope, id)
    const view = ref.current
    if (view !== null) AccessibilityInfo.sendAccessibilityEvent(view, "focus")
  }, [enabled, focusRequested, id, ref, scope])
  const subscribe = useCallback(
    (listener: () => void) => {
      scope?.listeners.add(listener)
      return () => scope?.listeners.delete(listener)
    },
    [scope],
  )
  return useSyncExternalStore(
    subscribe,
    () => scope?.focused === id,
    () => false,
  )
}

type SurfaceProps = ViewProps &
  Readonly<{
    children: ReactNode
    onAction?: (action: PlayerInputAction) => boolean
    enabled?: boolean
    modal?: boolean
  }>
function resolveInputView() {
  if (Platform.OS !== "android") return View
  try {
    return requireOptionalNativeModule("MapachessInput") === null
      ? View
      : withUniwind(
          requireNativeView<
            ViewProps & { onInput?: (event: { nativeEvent: unknown }) => void }
          >("MapachessInput"),
        )
  } catch {
    return View
  }
}
export function NativeInputSurface({
  children,
  onAction,
  enabled = true,
  modal = false,
  className,
  ...props
}: SurfaceProps) {
  const input = useContext(Input)
  const parent = useContext(Surface)
  const handler = useEffectEvent(
    (action: PlayerInputAction) => onAction?.(action) ?? false,
  )
  const available = useEffectEvent(() => enabled)
  const [scope] = useState<Scope>(() => ({
    controls: new Map(),
    focused: null,
    listeners: new Set(),
    handle: (action) => handler(action),
    enabled: () => available(),
    priority: (parent?.priority ?? 0) + (modal ? 1000 : 1),
  }))
  const [InputView] = useState(resolveInputView)
  useEffect(() => input?.register(scope), [input?.register, scope])
  return (
    <Surface value={scope}>
      <InputView
        {...props}
        onTouchStart={(event) => {
          input?.touch()
          props.onTouchStart?.(event)
        }}
        className={cx("min-h-0 flex-1", className)}
        {...(Platform.OS === "android"
          ? {
              onInput: (event: { nativeEvent: unknown }) =>
                input?.receive(event.nativeEvent),
            }
          : {})}
      >
        {children}
      </InputView>
    </Surface>
  )
}

type NativeHardwareEvents = { onInput: (event: unknown) => void }
declare class MapachessInputModule extends NativeModule<NativeHardwareEvents> {}
export default function NativeInputProvider({
  actor,
  children,
}: Readonly<{ actor: ProfileActor; children: ReactNode }>) {
  const profile = useActorSnapshot(actor)
  const bindings =
    selectCurrentPlayerData(profile)?.settings.inputBindings ??
    DEFAULT_PLAYER_INPUT_BINDINGS
  const scopes = useRef(new Set<Scope>())
  const inputRevision = useRef(0)
  const capture = useRef<((event: NativeInputEvent) => boolean) | null>(null)
  const requestPoll = useRef<() => void>(() => undefined)
  const [device, setDevice] = useState<PlayerInputDevice>({ method: "touch" })
  const [activity] = useState(nativeApplicationActivity)
  const dispatcher = useMemo(
    () =>
      createNativeInputDispatcher(
        () =>
          selectCurrentPlayerData(actor.getSnapshot())?.settings
            .inputBindings ?? DEFAULT_PLAYER_INPUT_BINDINGS,
        (action, source) => {
          if (
            Platform.OS === "ios" &&
            source.method === "keyboard" &&
            TextInput.State.currentlyFocusedInput() !== null &&
            action !== "cancel"
          )
            return
          setDevice(source)
          const revision = ++inputRevision.current
          const scope = [...scopes.current]
            .filter((entry) => entry.enabled())
            .sort((a, b) => a.priority - b.priority)
            .at(-1)
          const control = scope?.controls.get(scope.focused ?? "")
          if (
            scope !== undefined &&
            !(
              control?.enabled() === true && control.handle?.(action) === true
            ) &&
            !scope.handle(action)
          )
            void navigate(
              scope,
              action,
              () =>
                inputRevision.current === revision &&
                activity.isActive() &&
                scope.enabled() &&
                scopes.current.has(scope),
            )
        },
        (event) => capture.current?.(event) ?? false,
      ),
    [actor, activity],
  )
  const register = useCallback(
    (scope: Scope) => {
      scopes.current.add(scope)
      inputRevision.current++
      dispatcher.reset()
      return () => {
        scopes.current.delete(scope)
        inputRevision.current++
        dispatcher.reset()
      }
    },
    [dispatcher],
  )
  const receive = useCallback(
    (value: unknown) => {
      const event = decodeNativeInputEvent(value)
      if (event !== null && activity.isActive()) {
        dispatcher.receive(event)
        if (event.kind === "controller") requestPoll.current()
      }
    },
    [dispatcher, activity],
  )
  const touch = useCallback(() => {
    inputRevision.current++
    dispatcher.reset()
    setDevice((current) =>
      current.method === "touch" ? current : { method: "touch" },
    )
    for (const scope of scopes.current) {
      if (scope.focused === null) continue
      scope.focused = null
      for (const listener of scope.listeners) listener()
    }
  }, [dispatcher])
  useEffect(() => {
    const native =
      requireOptionalNativeModule<MapachessInputModule>("MapachessInput")
    const subscription = native?.addListener("onInput", receive)
    const removeActivity = activity.subscribe(() => {
      inputRevision.current++
      dispatcher.reset()
    })
    let frame: number | null = null
    const tick = (now: number): void => {
      frame = null
      if (!activity.isActive()) return
      dispatcher.tick(now)
      if (dispatcher.needsFrame()) frame = requestAnimationFrame(tick)
    }
    requestPoll.current = () => {
      if (frame === null) frame = requestAnimationFrame(tick)
    }
    return () => {
      requestPoll.current = () => undefined
      if (frame !== null) cancelAnimationFrame(frame)
      removeActivity()
      subscription?.remove()
      dispatcher.reset()
    }
  }, [dispatcher, receive, activity])
  const context = useMemo<InputContext>(
    () => ({
      device,
      bindings,
      register,
      receive,
      touch,
      capture: (listener) => {
        capture.current = listener
        inputRevision.current++
        dispatcher.reset()
        return () => {
          if (capture.current === listener) capture.current = null
          dispatcher.reset()
        }
      },
    }),
    [device, bindings, register, receive, touch, dispatcher],
  )
  return <Input value={context}>{children}</Input>
}
