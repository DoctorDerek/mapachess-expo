import type { MapachessCatalog } from "./catalog.js"
import emergencyGameCopy from "./emergencyGameCopy.js"
import emergencyInterface from "./emergencyInterface.js"
import {
  isMessageText,
  UNAVAILABLE_TEXT,
  unavailableText,
} from "./messageRecovery.js"

const ratingVariant = (variant: unknown): string =>
  isMessageText(variant) ? variant : "Selected"

// Invariant: this independent shape survives missing keys in both source catalogs.
const emergencyCatalog: MapachessCatalog = {
  introduction: {
    title: "Mapachess",
    region: "Introduction",
    heading: "Welcome to Mapachess",
    paragraphs: [
      {
        lead: "",
        body: UNAVAILABLE_TEXT,
      },
      {
        lead: "",
        body: UNAVAILABLE_TEXT,
      },
      {
        lead: "",
        body: UNAVAILABLE_TEXT,
      },
      {
        lead: "",
        body: UNAVAILABLE_TEXT,
      },
      {
        lead: "",
        body: UNAVAILABLE_TEXT,
      },
    ],
    language: "Language",
    start: "Start",
    starting: "Starting…",
    credit: UNAVAILABLE_TEXT,
    author: UNAVAILABLE_TEXT,
    website: UNAVAILABLE_TEXT,
    websiteNewTab: UNAVAILABLE_TEXT,
  },
  profile: {
    settingsTitle: "Settings",
    moveReactionPlacement: {
      label: "Move feedback position",
      description:
        "Beside the board on desktop; over the board on smaller screens.",
      options: { top: "Top", middle: "Midpoint", bottom: "Bottom" },
    },
    ratedMatches: unavailableText,
    rating: (variant: string): string =>
      `${ratingVariant(variant)} Elo unavailable`,
    ratingLabel: {
      standard: "Standard Chess Elo",
      chess960: "Chess960 Elo",
    },
    resetRating: (variant: string): string =>
      `Reset ${ratingVariant(variant)} Elo`,
    resetQuestion: (variant: string): string =>
      `Reset ${ratingVariant(variant)} Elo?`,
    resetExplanation: () =>
      "This resets the selected rating. Export a backup first, or cancel to keep it.",
    resetConfirmation: (variant: string): string =>
      `Reset ${ratingVariant(variant)} Elo`,
    preparingBackup: UNAVAILABLE_TEXT,
    none: UNAVAILABLE_TEXT,
    included: UNAVAILABLE_TEXT,
    fileTooLarge: UNAVAILABLE_TEXT,
    fileUnreadable: UNAVAILABLE_TEXT,
    importIssue: {
      integrity: UNAVAILABLE_TEXT,
      size: UNAVAILABLE_TEXT,
      version: UNAVAILABLE_TEXT,
      read: UNAVAILABLE_TEXT,
      invalid: UNAVAILABLE_TEXT,
    },
    persistenceFailure: {
      conflict: UNAVAILABLE_TEXT,
      verification: UNAVAILABLE_TEXT,
      request: UNAVAILABLE_TEXT,
      unsafe: UNAVAILABLE_TEXT,
    },
    inspectingBackup: UNAVAILABLE_TEXT,
    savingData: UNAVAILABLE_TEXT,
    artworkPreview: unavailableText,
    cardPreview: unavailableText,
    cardDescription: unavailableText,
    level: UNAVAILABLE_TEXT,
    playFree: UNAVAILABLE_TEXT,
    cardFormats: {
      GIF: UNAVAILABLE_TEXT,
      PNG: UNAVAILABLE_TEXT,
    },
    saveToShare: UNAVAILABLE_TEXT,
    animalCompanion: UNAVAILABLE_TEXT,
    saveFormat: unavailableText,
    shareFormat: unavailableText,
    retryFormat: unavailableText,
    preparingFormat: unavailableText,
    shared: UNAVAILABLE_TEXT,
    shareFailed: UNAVAILABLE_TEXT,
    downloadRequested: unavailableText,
    downloadFailed: UNAVAILABLE_TEXT,
    customization: {
      coach: {
        label: UNAVAILABLE_TEXT,
        change: UNAVAILABLE_TEXT,
        done: UNAVAILABLE_TEXT,
      },
      pieces: {
        label: UNAVAILABLE_TEXT,
        change: UNAVAILABLE_TEXT,
        done: UNAVAILABLE_TEXT,
      },
      board: {
        label: UNAVAILABLE_TEXT,
        change: UNAVAILABLE_TEXT,
        done: UNAVAILABLE_TEXT,
      },
    },
    coachCollections: {
      mapachito: UNAVAILABLE_TEXT,
      greyfox: UNAVAILABLE_TEXT,
    },
    dressing: {
      categories: {
        Clothes: UNAVAILABLE_TEXT,
        Weapons: UNAVAILABLE_TEXT,
        Hair: UNAVAILABLE_TEXT,
        Skin: UNAVAILABLE_TEXT,
        Face: UNAVAILABLE_TEXT,
        Animal: UNAVAILABLE_TEXT,
      },
      choices: unavailableText,
      selection: unavailableText,
      saving: UNAVAILABLE_TEXT,
      unsaved: UNAVAILABLE_TEXT,
      saved: UNAVAILABLE_TEXT,
      weapons: {
        none: UNAVAILABLE_TEXT,
        weapon1: UNAVAILABLE_TEXT,
        weapon2: UNAVAILABLE_TEXT,
        weapon3: UNAVAILABLE_TEXT,
        weapon4: UNAVAILABLE_TEXT,
        weapon5: UNAVAILABLE_TEXT,
      },
      weaponColor: unavailableText,
      clothingColor: unavailableText,
      outfit: unavailableText,
      hairColor: unavailableText,
      hairstyle: unavailableText,
      skin: unavailableText,
      face: unavailableText,
    },
  },
  interface: emergencyInterface,
  ...emergencyGameCopy,
}

export default emergencyCatalog
