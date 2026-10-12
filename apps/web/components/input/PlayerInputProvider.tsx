"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import type { ActorRefFrom } from "xstate"
import type { PlayerInputDevice } from "@mapachess/match-presentation/input-prompts"
import DEFAULT_PLAYER_INPUT_BINDINGS, {
  isInputDirection,
  type PlayerInputAction,
  type PlayerInputBindings,
} from "@mapachess/match/player-input"
import profileMachine, {
  selectCurrentPlayerData,
} from "@mapachess/profile/profile-machine"
import useWebPlayerInput from "../../lib/input/useWebPlayerInput"
import {
  activateInput,
  foregroundInputRoot,
  isInputVisible,
  moveInputFocus,
} from "../../lib/input/webFocusNavigation"

type InputScope = Readonly<{
  root: RefObject<HTMLElement | null>
  handle: (action: PlayerInputAction, device: PlayerInputDevice) => boolean
  enabled?: boolean
  focused?: boolean
}>
type PlayerInputContextValue = Readonly<{
  bindings: PlayerInputBindings
  device: PlayerInputDevice
  register: (scope: InputScope) => () => void
}>
const PlayerInputContext = createContext<PlayerInputContextValue | null>(null)
export const usePlayerInput = (): PlayerInputContextValue | null =>
  useContext(PlayerInputContext)

export function usePlayerInputScope(scope: InputScope): boolean {
  const input = usePlayerInput()
  const register = input?.register
  useEffect(
    () => register?.(scope),
    [register, scope.root, scope.handle, scope.enabled, scope.focused],
  )
  return input !== null
}

export default function PlayerInputProvider({
  children,
  profileActor,
}: Readonly<{
  children: ReactNode
  profileActor: ActorRefFrom<typeof profileMachine> | null
}>) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const subscription = profileActor?.subscribe(notify)
      return () => subscription?.unsubscribe()
    },
    [profileActor],
  )
  const readBindings = useCallback(
    () =>
      (profileActor === null
        ? null
        : selectCurrentPlayerData(profileActor.getSnapshot())
      )?.settings.inputBindings ?? DEFAULT_PLAYER_INPUT_BINDINGS,
    [profileActor],
  )
  const bindings = useSyncExternalStore(
    subscribe,
    readBindings,
    () => DEFAULT_PLAYER_INPUT_BINDINGS,
  )
  const [device, setDevice] = useState<PlayerInputDevice>({ method: "pointer" })
  const scopes = useRef(new Set<InputScope>())
  const lastFocus = useRef<HTMLElement | null>(null)
  const register = useCallback((scope: InputScope) => {
    scopes.current.add(scope)
    return () => {
      scopes.current.delete(scope)
    }
  }, [])
  useWebPlayerInput({
    bindings,
    onDevice: (next) =>
      setDevice((current) =>
        current.method === next.method &&
        (current.method !== "controller" ||
          next.method !== "controller" ||
          current.family === next.family)
          ? current
          : next,
      ),
    onAction: (action, source) => {
      const foreground = foregroundInputRoot()
      const active = [...scopes.current]
        .filter((scope) => {
          const root = scope.root.current
          return (
            scope.enabled !== false &&
            root !== null &&
            isInputVisible(root) &&
            foreground.contains(root) &&
            (scope.focused !== true || root.contains(document.activeElement))
          )
        })
        .sort((a, b) =>
          a.root.current?.contains(b.root.current)
            ? 1
            : b.root.current?.contains(a.root.current)
              ? -1
              : 0,
        )
      for (const scope of active) if (scope.handle(action, source)) return true
      if (isInputDirection(action)) {
        moveInputFocus(foreground, action, lastFocus.current)
        return true
      }
      return action === "confirm" && activateInput(foreground)
    },
  })
  return (
    <PlayerInputContext value={{ bindings, device, register }}>
      <div
        onFocusCapture={(event) => {
          lastFocus.current = event.target
        }}
        data-input-method={device.method}
        className="data-[input-method=controller]:[&_:focus]:outline-mapachito-orange contents data-[input-method=controller]:[&_:focus]:outline-3 data-[input-method=controller]:[&_:focus]:outline-offset-2"
      >
        {children}
      </div>
    </PlayerInputContext>
  )
}
