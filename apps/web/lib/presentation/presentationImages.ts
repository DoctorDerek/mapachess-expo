export type PresentationImage = Readonly<{
  ready: Promise<boolean>
  release: () => void
}>

export type PresentationImageLoader = (source: string) => PresentationImage

export type PresentationImages = Readonly<{
  retain: (sources: readonly string[]) => void
  prepare: (sources: readonly string[]) => Promise<boolean>
}>

export const loadPresentationImage: PresentationImageLoader = (source) => {
  const image = new Image()
  let settled = false
  image.src = source
  const ready = image.decode().then(
    () => {
      settled = true
      return image.naturalWidth > 0
    },
    () => {
      settled = true
      return false
    },
  )
  return {
    ready,
    release: () => {
      if (!settled) image.src = ""
    },
  }
}

export default function createPresentationImages(
  load: PresentationImageLoader = loadPresentationImage,
): PresentationImages {
  const images = new Map<string, PresentationImage>()
  return {
    retain(sources: readonly string[]): void {
      const retained = new Set(sources)
      for (const [source, image] of images) {
        if (retained.has(source)) continue
        image.release()
        images.delete(source)
      }
    },
    async prepare(sources: readonly string[]): Promise<boolean> {
      const readiness = await Promise.all(
        [...new Set(sources)].map(async (source) => {
          let image = images.get(source)
          if (image === undefined) {
            image = load(source)
            images.set(source, image)
          }
          const ready = await image.ready
          const isCurrent = images.get(source) === image
          if (!ready && isCurrent) {
            images.delete(source)
            image.release()
          }
          return ready && isCurrent
        }),
      )
      return readiness.every(Boolean)
    },
  }
}
