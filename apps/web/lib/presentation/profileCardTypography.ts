export const PROFILE_CARD_FALLBACK_FONT = '"Trebuchet MS", Arial, sans-serif'

export const PROFILE_CARD_TYPOGRAPHY = {
  label: { weight: 700, size: 33 },
  value: { weight: 900, size: 65 },
  category: { weight: 700, size: 24 },
  invitation: { weight: 700, size: 34 },
} as const

export default async function loadProfileCardFont(): Promise<string> {
  try {
    const family = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-nunito-sans")
      .trim()
    if (family === "") return PROFILE_CARD_FALLBACK_FONT
    await Promise.all(
      [PROFILE_CARD_TYPOGRAPHY.label, PROFILE_CARD_TYPOGRAPHY.value].map(
        ({ weight, size }) =>
          document.fonts.load(`${weight} ${size}px ${family}`),
      ),
    )
    return family
  } catch {
    return PROFILE_CARD_FALLBACK_FONT
  }
}
