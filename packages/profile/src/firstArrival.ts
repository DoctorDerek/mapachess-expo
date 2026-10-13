import type { CandidateLocale, ShippedLocale } from "./locale.js"

export type FirstArrivalPreferences = Readonly<{
  introductionCompleted: boolean
  locale: CandidateLocale | null
}>

type IntroductionCopy = Readonly<{
  title: string
  region: string
  heading: string
  paragraphs: readonly Readonly<{ lead: string; body: string }>[]
  language: string
  start: string
  starting: string
  credit: string
  author: string
  website: string
  websiteNewTab: string
}>

const english = Object.freeze({
  title: "Mapachess",
  region: "Introduction",
  heading: "Chess with Better Hints.",
  paragraphs: Object.freeze([
    {
      lead: "",
      body: "Play Standard Chess or Chess960 against animal Stockfish opponents. Climb the 23-opponent Story ladder, or choose your own Challenge.",
    },
    {
      lead: "See the possibilities.",
      body: "Piece Hints highlight three pieces for each side. Then Move Hints show three moves for those pieces on each side. You decide when you want help.",
    },
    {
      lead: "Try another idea.",
      body: "Undo a move, explore a different line, and keep learning. Your coach and animal battles react as the match unfolds.",
    },
    {
      lead: "Make it your game.",
      body: "Choose your player animal, coach, chess pieces, and board. Find these choices later in Your game customization.",
    },
    {
      lead: "",
      body: "Free to play. No account. Your progress stays on this device. Export a backup from Settings whenever you want a portable copy.",
    },
  ]),
  language: "Language",
  start: "Start",
  starting: "Starting…",
  credit: "A Mapachito Game",
  author: "by Dr. Derek Austin",
  website: "DoctorDerek.com",
  websiteNewTab: " (opens in a new tab)",
}) satisfies IntroductionCopy

const catalogs = Object.freeze({ en: english }) satisfies Readonly<
  Record<ShippedLocale, IntroductionCopy>
>

export default function firstArrivalCopy(
  locale: ShippedLocale,
): IntroductionCopy {
  return catalogs[locale]
}
