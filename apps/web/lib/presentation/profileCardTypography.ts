export const PROFILE_CARD_FALLBACK_FONT = '"Trebuchet MS", Arial, sans-serif'

export default async function loadProfileCardFont(): Promise<string> {
  try {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-nunito-sans")
      .trim()
    if (family === "") return PROFILE_CARD_FALLBACK_FONT
    await Promise.all(
      [700, 900].map((weight) =>
        document.fonts.load(`${weight} 32px ${family}`),
      ),
    )
    return family
  } catch {
    return PROFILE_CARD_FALLBACK_FONT
  }
}
