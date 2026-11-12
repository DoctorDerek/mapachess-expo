// @vitest-environment happy-dom
import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { installDomHarness } from "../test/domHarness"
import OfflineRegistration from "./OfflineRegistration"

installDomHarness()
afterEach(() => vi.unstubAllEnvs())

describe("non-blocking offline registration lifecycle", () => {
  it("registers only after page load with the canonical scope and cache policy", async () => {
    const register = vi.fn(async () => undefined)
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("navigator", { serviceWorker: { register } })
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading")
    const view = render(<OfflineRegistration />)
    expect(register).not.toHaveBeenCalled()
    await act(async () => fireEvent(window, new Event("load")))
    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
    view.unmount()
    fireEvent(window, new Event("load"))
    expect(register).toHaveBeenCalledOnce()
  })

  it("recovers a rejected registration without blocking the application or retrying forever", async () => {
    const register = vi.fn(async () => {
      throw new Error("Offline storage unavailable")
    })
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("navigator", { serviceWorker: { register } })
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete")
    await act(async () => {
      render(<OfflineRegistration />)
    })
    expect(register).toHaveBeenCalledOnce()
  })

  it("cancels a pending page-load listener on unmount", () => {
    const register = vi.fn(async () => undefined)
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("navigator", { serviceWorker: { register } })
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading")
    const view = render(<OfflineRegistration />)
    view.unmount()
    fireEvent(window, new Event("load"))
    expect(register).not.toHaveBeenCalled()
  })

  it.each(["development", "test"])(
    "does not install a service worker in %s",
    (environment) => {
      const register = vi.fn()
      vi.stubEnv("NODE_ENV", environment)
      vi.stubGlobal("navigator", { serviceWorker: { register } })
      render(<OfflineRegistration />)
      fireEvent(window, new Event("load"))
      expect(register).not.toHaveBeenCalled()
    },
  )

  it("tolerates a browser without service-worker support", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("navigator", {})
    expect(() => render(<OfflineRegistration />)).not.toThrow()
  })
})
