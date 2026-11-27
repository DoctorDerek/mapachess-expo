const FIRST_CONTENTFUL_PAINT = "first-contentful-paint"

export default function waitForFirstContentfulPaint(): Promise<void> {
  if (
    document.visibilityState !== "visible" ||
    performance.getEntriesByName(FIRST_CONTENTFUL_PAINT, "paint").length > 0
  )
    return Promise.resolve()

  return new Promise<void>((resolve) => {
    let observer: PerformanceObserver | undefined
    let frame: number | undefined

    function finish(): void {
      observer?.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
      document.removeEventListener("visibilitychange", visibilityChanged)
      resolve()
    }

    function visibilityChanged(): void {
      if (document.visibilityState !== "visible") finish()
    }

    document.addEventListener("visibilitychange", visibilityChanged)
    if (
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("paint")
    ) {
      observer = new PerformanceObserver((entries) => {
        if (entries.getEntriesByName(FIRST_CONTENTFUL_PAINT, "paint").length)
          finish()
      })
      observer.observe({ type: "paint", buffered: true })
    } else {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(finish)
      })
    }
  })
}
