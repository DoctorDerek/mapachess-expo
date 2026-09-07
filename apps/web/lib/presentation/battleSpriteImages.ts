export type BattleSpriteImage = Readonly<{
  ready: Promise<boolean>
  release: () => void
}>

export type BattleSpriteImageLoader = (source: string) => BattleSpriteImage

export type BattleSpriteImages = Readonly<{
  retain: (sources: readonly string[]) => void
  prepare: (sources: readonly string[]) => Promise<boolean>
}>

export const loadBattleSpriteImage: BattleSpriteImageLoader = (source) => {
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

export default function createBattleSpriteImages(
  load: BattleSpriteImageLoader = loadBattleSpriteImage,
): BattleSpriteImages {
  const images = new Map<string, BattleSpriteImage>()
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
          if (!ready && images.get(source) === image) {
            images.delete(source)
            image.release()
          }
          return ready
        }),
      )
      return readiness.every(Boolean)
    },
  }
}
