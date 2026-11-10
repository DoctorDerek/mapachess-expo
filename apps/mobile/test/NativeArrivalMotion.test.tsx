import "./nativeUiEnvironment"
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals"
import { act, render, renderHook, waitFor } from "@testing-library/react-native"
import { AccessibilityInfo, View } from "react-native"
import * as motion from "react-native-reanimated"
import NativeArrivalAnimation from "@/components/profile/NativeArrivalAnimation"
import useNativeFirstArrival from "@/lib/presentation/useNativeFirstArrival"

const mockReady = jest.fn<() => Promise<boolean>>()
const mockPlay = jest.fn<() => Promise<void>>()
let mockRiveError: Error | null = null
jest.mock("@rive-app/react-native", () => ({
  Alignment: { Center: "center" },
  Fit: { Cover: "cover" },
  RiveView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
  useRive: () => ({ riveViewRef: mockPlayer, setHybridRef: () => undefined }),
  useRiveFile: () => ({
    riveFile: mockRiveError === null ? {} : null,
    error: mockRiveError,
  }),
}))
const mockPlayer = { awaitViewReady: mockReady, play: mockPlay }
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
  default: { images: new Proxy({}, { get: () => 1 }) },
}))

beforeEach(() => {
  mockRiveError = null
  mockReady.mockReset().mockResolvedValue(true)
  mockPlay.mockReset().mockResolvedValue(undefined)
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

it("waits for Rive readiness before playing and cleans both crossing tracks on unmount", async () => {
  const ready = Promise.withResolvers<boolean>()
  mockReady.mockReturnValueOnce(ready.promise)
  const timing = jest.spyOn(motion, "withTiming")
  const cancel = jest.spyOn(motion, "cancelAnimation")
  const unavailable = jest.fn()
  const view = await render(
    <NativeArrivalAnimation onUnavailable={unavailable} />,
  )
  expect(mockPlay).not.toHaveBeenCalled()
  await act(() => ready.resolve(true))
  expect(mockPlay).toHaveBeenCalledTimes(1)
  expect(timing).toHaveBeenCalledTimes(2)
  await view.unmount()
  expect(cancel).toHaveBeenCalledTimes(2)
})

it("leaves the still image available if loading or playback fails", async () => {
  const fallback = jest.fn()
  mockRiveError = new Error("Rive unavailable")
  mockReady.mockResolvedValueOnce(false)
  const failedLoad = await render(
    <NativeArrivalAnimation onUnavailable={fallback} />,
  )
  expect(fallback).toHaveBeenCalledTimes(1)
  expect(mockPlay).not.toHaveBeenCalled()
  await failedLoad.unmount()
  mockRiveError = null
  mockPlay.mockRejectedValueOnce(new Error("Rive view failed"))
  const failedView = await render(
    <NativeArrivalAnimation onUnavailable={fallback} />,
  )
  await waitFor(() => expect(fallback).toHaveBeenCalledTimes(2))
  await failedView.rerender(<View />)
})
