import "./nativeUiEnvironment"
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native"
import { AccessibilityInfo, View } from "react-native"
import * as motion from "react-native-reanimated"
import loadCatalog from "@mapachess/localization/catalog"
import { LOCALE_LABELS } from "@mapachess/localization/locale"
import { MAPACHITO_SPRITE_MANIFEST } from "@mapachess/match-presentation/presentation-assets"
import { selectCurrentPlayerData } from "@mapachess/profile/profile-machine"
import NativeArrivalAnimation, {
  NativeArrivalRaccoon,
} from "@/components/profile/NativeArrivalAnimation"
import NativeIntroduction from "@/components/profile/NativeIntroduction"
import NativeLocaleProvider from "@/components/profile/NativeLocaleProvider"
import useNativeFirstArrival from "@/lib/presentation/useNativeFirstArrival"
import openNativeProfileRuntime from "@/lib/profile/openNativeProfileRuntime"
import InMemoryAsyncStorage from "./nativeStorageFixture"

const mockReady = jest.fn<() => Promise<boolean>>()
const mockPlay = jest.fn<() => Promise<void>>()
let mockRiveError: Error | null = null
const mockRiveFile = {}
jest.mock("@rive-app/react-native", () => ({
  Alignment: { Center: "center" },
  Fit: { Cover: "cover" },
  RiveView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
  useRive: () => ({ riveViewRef: mockPlayer, setHybridRef: () => undefined }),
  useRiveFile: () => ({
    riveFile: mockRiveError === null ? mockRiveFile : null,
    error: mockRiveError,
  }),
}))
const mockPlayer = { awaitViewReady: mockReady, play: mockPlay }
const uniwind = jest.requireMock<typeof import("uniwind")>("uniwind")
const runImage = () =>
  screen.getByTestId(MAPACHITO_SPRITE_MANIFEST.animations.run.sourceId, {
    includeHiddenElements: true,
  })
const idleGlobals = ["requestIdleCallback", "cancelIdleCallback"].map(
  (key) => ({
    key,
    original: Object.getOwnPropertyDescriptor(globalThis, key),
  }),
)
jest.mock("@/lib/gameplay/nativeApplicationActivity", () => ({
  __esModule: true,
  default: () => ({ isActive: () => true, subscribe: () => () => undefined }),
}))
jest.mock("@/lib/presentation/nativeAnimationManifest", () => ({
  __esModule: true,
  default: { "/first-arrival/ice-cream.riv": 1 },
}))
jest.mock("@/lib/presentation/nativeAssetManifest", () => ({
  __esModule: true,
  default: { images: new Proxy({}, { get: () => 1 }), svg: {} },
}))

beforeEach(() => {
  mockRiveError = null
  mockReady.mockReset().mockResolvedValue(true)
  mockPlay.mockReset().mockResolvedValue(undefined)
  jest
    .spyOn(uniwind, "useResolveClassNames")
    .mockReturnValue({ transitionDuration: "3200ms" })
  jest
    .spyOn(motion, "withTiming")
    .mockImplementation(function holdNativeTimingUntilCompletion<
      Value extends Parameters<typeof motion.withTiming>[0],
    >(value: Value) {
      return value
    })
})

afterEach(() => {
  for (const { key, original } of idleGlobals)
    if (original === undefined) Reflect.deleteProperty(globalThis, key)
    else Object.defineProperty(globalThis, key, original)
})

it("waits for both first paint and idle time, but does not schedule motion under Reduced Motion", async () => {
  const idle = jest.fn<typeof requestIdleCallback>().mockReturnValue(1)
  const cancel = jest.fn<typeof cancelIdleCallback>()
  Object.defineProperties(globalThis, {
    requestIdleCallback: { configurable: true, value: idle },
    cancelIdleCallback: { configurable: true, value: cancel },
  })
  const reduced = jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValueOnce(true)
  const staticArrival = await renderHook(() => useNativeFirstArrival(true))
  expect(staticArrival.result.current.visible).toBe(false)
  expect(idle).not.toHaveBeenCalled()
  await staticArrival.unmount()

  reduced.mockResolvedValueOnce(false)
  const animated = await renderHook(
    ({ painted }: Readonly<{ painted: boolean }>) =>
      useNativeFirstArrival(painted),
    { initialProps: { painted: false } },
  )
  expect(idle).not.toHaveBeenCalled()
  await animated.rerender({ painted: true })
  await waitFor(() => expect(idle).toHaveBeenCalledTimes(1))
  expect(animated.result.current.visible).toBe(false)
  const callback = idle.mock.lastCall?.[0]
  if (callback === undefined) throw new Error("Expected an idle callback")
  await act(() => callback({ didTimeout: false, timeRemaining: () => 15 }))
  expect(animated.result.current.visible).toBe(true)
  await act(() => animated.result.current.cancel())
  expect(animated.result.current.visible).toBe(false)
  expect(cancel).toHaveBeenCalledWith(1)
  await animated.unmount()
})

it("waits for Rive readiness before reporting playback without starting a crossing clock", async () => {
  const ready = Promise.withResolvers<boolean>()
  mockReady.mockReturnValueOnce(ready.promise)
  const timing = jest.spyOn(motion, "withTiming")
  const unavailable = jest.fn()
  const started = jest.fn()
  const view = await render(
    <NativeArrivalAnimation onStarted={started} onUnavailable={unavailable} />,
  )
  expect(mockPlay).not.toHaveBeenCalled()
  await act(() => ready.resolve(true))
  expect(mockPlay).toHaveBeenCalledTimes(1)
  expect(started).toHaveBeenCalledTimes(1)
  expect(timing).not.toHaveBeenCalled()
  expect(unavailable).not.toHaveBeenCalled()
  await view.unmount()
})

it("does not finish the Rive presentation when the independent crossing ends", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false)
  const idle = jest.fn<typeof requestIdleCallback>().mockReturnValue(1)
  Object.defineProperties(globalThis, {
    requestIdleCallback: { configurable: true, value: idle },
    cancelIdleCallback: { configurable: true, value: jest.fn() },
  })
  const hook = await renderHook(() => useNativeFirstArrival(true))
  await waitFor(() => expect(idle).toHaveBeenCalledTimes(1))
  await act(() =>
    idle.mock.calls[0]?.[0]({ didTimeout: false, timeRemaining: () => 15 }),
  )
  expect(hook.result.current.runRaccoon).toBe(false)
  await act(() => hook.result.current.onStarted())
  expect(hook.result.current.runRaccoon).toBe(true)
  await act(() => hook.result.current.onCrossingComplete())
  expect(hook.result.current.runRaccoon).toBe(false)
  expect(hook.result.current.visible).toBe(true)
  await act(() => hook.result.current.cancel())
  expect(hook.result.current.visible).toBe(false)
  await hook.unmount()
})

it("waits for the actual raccoon image then cancels both owned crossing tracks", async () => {
  const timing = jest.spyOn(motion, "withTiming")
  const cancel = jest.spyOn(motion, "cancelAnimation")
  const complete = jest.fn()
  const view = await render(<NativeArrivalRaccoon onComplete={complete} />)
  expect(timing).not.toHaveBeenCalled()
  await fireEvent(runImage(), "load")
  expect(timing).toHaveBeenCalledTimes(2)
  expect(
    timing.mock.calls.some(([, options]) => options?.duration === 3200),
  ).toBe(true)
  expect(complete).not.toHaveBeenCalled()
  const finish = timing.mock.calls.find(
    ([, , callback]) => callback !== undefined,
  )?.[2]
  if (finish === undefined)
    throw new Error("The crossing must report its native animation completion.")
  await act(() => finish(true))
  expect(complete).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(cancel).toHaveBeenCalledTimes(2)
  await act(() => finish(true))
  expect(complete).toHaveBeenCalledTimes(1)
})

it("uses the resolved wide crossing duration and safely abandons a failed sprite", async () => {
  jest
    .mocked(uniwind.useResolveClassNames)
    .mockReturnValue({ transitionDuration: "4000ms" })
  const timing = jest.spyOn(motion, "withTiming")
  const complete = jest.fn()
  const view = await render(<NativeArrivalRaccoon onComplete={complete} />)
  await fireEvent(runImage(), "load")
  expect(
    timing.mock.calls.some(([, options]) => options?.duration === 4000),
  ).toBe(true)
  await fireEvent(runImage(), "error")
  expect(complete).toHaveBeenCalledTimes(1)
  await view.unmount()
})

it("ignores Rive readiness delivered after its presentation unmounts", async () => {
  const ready = Promise.withResolvers<boolean>()
  mockReady.mockReturnValueOnce(ready.promise)
  const started = jest.fn()
  const unavailable = jest.fn()
  const view = await render(
    <NativeArrivalAnimation onStarted={started} onUnavailable={unavailable} />,
  )
  await view.unmount()
  await act(() => ready.resolve(true))
  expect(mockPlay).not.toHaveBeenCalled()
  expect(started).not.toHaveBeenCalled()
  expect(unavailable).not.toHaveBeenCalled()
})

it("drives the actual introduction from layout to optional motion and cancels it when choosing language or Start", async () => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false)
  const idle = jest.fn<typeof requestIdleCallback>().mockReturnValue(1)
  const cancel = jest.fn<typeof cancelIdleCallback>()
  Object.defineProperties(globalThis, {
    requestIdleCallback: { configurable: true, value: idle },
    cancelIdleCallback: { configurable: true, value: cancel },
  })
  const runtime = await openNativeProfileRuntime({
    storage: new InMemoryAsyncStorage(),
  })
  try {
    await waitFor(() =>
      expect(runtime.actor.getSnapshot().matches("ready")).toBe(true),
    )
    const view = await render(
      <NativeLocaleProvider actor={runtime.actor}>
        <NativeIntroduction actor={runtime.actor} pending={false} />
      </NativeLocaleProvider>,
    )
    expect(mockPlay).not.toHaveBeenCalled()
    await fireEvent(
      screen.getByRole("header", {
        name: loadCatalog("en").introduction.title,
      }),
      "layout",
    )
    await waitFor(() => expect(idle).toHaveBeenCalledTimes(1))
    await act(() =>
      idle.mock.calls[0]?.[0]({ didTimeout: false, timeRemaining: () => 15 }),
    )
    await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1))
    expect(runImage()).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole("button", { name: LOCALE_LABELS["es-419"] }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.actor.getSnapshot())?.settings.locale,
      ).toBe("es-419"),
    )
    expect(
      screen.queryByTestId(MAPACHITO_SPRITE_MANIFEST.animations.run.sourceId, {
        includeHiddenElements: true,
      }),
    ).toBeNull()
    expect(cancel).toHaveBeenCalledWith(1)
    await fireEvent.press(
      screen.getByRole("button", {
        name: loadCatalog("es-419").introduction.start,
      }),
    )
    await waitFor(() =>
      expect(
        selectCurrentPlayerData(runtime.actor.getSnapshot())
          ?.introductionCompleted,
      ).toBe(true),
    )
    expect(mockPlay).toHaveBeenCalledTimes(1)
    await view.unmount()
  } finally {
    await runtime.close()
  }
})

it("leaves the still image available if loading or playback fails", async () => {
  const fallback = jest.fn()
  mockRiveError = new Error("Rive unavailable")
  mockReady.mockResolvedValueOnce(false)
  const failedLoad = await render(
    <NativeArrivalAnimation onStarted={jest.fn()} onUnavailable={fallback} />,
  )
  expect(fallback).toHaveBeenCalledTimes(1)
  expect(mockPlay).not.toHaveBeenCalled()
  await failedLoad.unmount()
  mockRiveError = null
  mockPlay.mockRejectedValueOnce(new Error("Rive view failed"))
  const failedView = await render(
    <NativeArrivalAnimation onStarted={jest.fn()} onUnavailable={fallback} />,
  )
  await waitFor(() => expect(fallback).toHaveBeenCalledTimes(2))
  await failedView.rerender(<View />)
})
