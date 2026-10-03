type PresentationPlayback = Readonly<{
  pause: () => void
  play: () => void
}>

export default function pausePresentationWhileHidden(
  playback: PresentationPlayback,
): () => void {
  const followVisibility = (): void => {
    if (document.hidden) playback.pause()
    else playback.play()
  }
  if (document.hidden) playback.pause()
  document.addEventListener("visibilitychange", followVisibility)
  return () =>
    document.removeEventListener("visibilitychange", followVisibility)
}
