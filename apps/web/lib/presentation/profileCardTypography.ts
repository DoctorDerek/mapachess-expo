import { PROFILE_CARD_TYPOGRAPHY } from "@mapachess/match-presentation/profile-card-format"

export const PROFILE_CARD_FALLBACK_FONT = '"Trebuchet MS", Arial, sans-serif'

export { PROFILE_CARD_TYPOGRAPHY } from "@mapachess/match-presentation/profile-card-format"

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
