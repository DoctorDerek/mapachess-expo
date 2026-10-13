import type { IntroductionCopy } from "./catalog.js"
import setup from "./enSetup.js"

const introduction = Object.freeze({
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

const english = Object.freeze({ introduction, setup })

export default english
