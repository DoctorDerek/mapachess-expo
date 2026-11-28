import {
  preparedArtSource,
  resolveArtSource,
} from "@/lib/presentation/characterArtPack"

export type PresentationImage = Readonly<{
  ready: Promise<boolean>
  release: () => void
}>

export type PresentationImageLoader = (source: string) => PresentationImage

export type PresentationImages = Readonly<{
  retain: (sources: readonly string[]) => void
  prepare: (sources: readonly string[]) => Promise<boolean>
}>

export function loadPresentationImage(
  source: string,
  resolve: (source: string) => string | Promise<string> = (path) =>
    preparedArtSource(path) ?? resolveArtSource(path),
): PresentationImage {
  const image = new Image()
  let settled = false
  let released = false
  const decode = async (url: string): Promise<boolean> => {
    if (released) return false
    image.src = url
    await image.decode()
    return !released && image.naturalWidth > 0
  }
  const available = resolve(source)
  const ready = (
    typeof available === "string" ? decode(available) : available.then(decode)
  )
    .catch(() => false)
    .finally(() => {
      settled = true
    })
  return {
    ready,
    release: () => {
      released = true
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
      const requestedImages = [...new Set(sources)].map((source) => {
        let image = images.get(source)
        if (image === undefined) {
          image = load(source)
          images.set(source, image)
        }
        return { source, image }
      })
      const readiness = await Promise.all(
        requestedImages.map(async ({ source, image }) => {
          const ready = await image.ready
          const isCurrent = images.get(source) === image
          if (!ready && isCurrent) {
            images.delete(source)
            image.release()
          }
          return ready && isCurrent
        }),
      )
      return (
        readiness.every(Boolean) &&
        requestedImages.every(
          ({ source, image }) => images.get(source) === image,
        )
      )
    },
  }
}
