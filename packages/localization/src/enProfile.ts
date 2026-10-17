import { formatUngroupedInteger } from "./enNumbers.js"

const profile = {
  settingsTitle: "Your game customization",
  ratedMatches: (count: number): string =>
    `${formatUngroupedInteger(count)} rated ${count === 1 ? "match" : "matches"}`,
  rating: (variant: string, elo: number): string =>
    `${variant} · ${formatUngroupedInteger(elo)} Elo`,
  ratingLabel: { standard: "Standard Chess Elo", chess960: "Chess960 Elo" },
  resetRating: (variant: string): string => `Reset ${variant} Elo`,
  resetQuestion: (variant: string): string => `Reset ${variant} Elo?`,
  resetExplanation: (variant: string): string =>
    `${variant} Elo returns to 100 and its rated-match count to zero. All other ratings, Story progress, medals, Challenge records, settings, and the active match stay unchanged. Completed matches cannot be rated again. Export your data first if you want a backup.`,
  resetConfirmation: (variant: string): string => `Reset ${variant} Elo to 100`,
  preparingBackup: "Preparing backup…",
  none: "None",
  included: "Included",
  fileTooLarge:
    "That file is larger than Mapachess can safely inspect. Your saved data is unchanged.",
  fileUnreadable:
    "That file could not be read. Your saved data is unchanged. Choose the file again or select another backup.",
  importIssue: {
    integrity:
      "The backup did not pass its integrity check. Your saved data is unchanged.",
    size: "The selected backup is larger than Mapachess can safely inspect. Your saved data is unchanged.",
    version:
      "This backup uses a newer Mapachess data format that this version cannot read. Your saved data is unchanged.",
    read: "The selected backup could not be read. Your saved data is unchanged.",
    invalid:
      "The selected file is not a valid Mapachess backup. Your saved data is unchanged.",
  },
  persistenceFailure: {
    conflict:
      "Another Mapachess tab changed local data first. Your pending change is still held here and has not overwritten it.",
    verification:
      "Mapachess could not verify the saved copy. Your pending change is still held here.",
    request:
      "Storage did not finish saving. Your unsaved change is still here.",
    unsafe:
      "Mapachess could not safely save this change. Your pending change is still held here.",
  },
  inspectingBackup:
    "Inspecting the selected backup. Nothing has been replaced.",
  savingData: "Saving and verifying your local data…",
  artworkPreview: (pieces: string, board: string): string =>
    `${pieces} pieces on ${board} board preview`,
  cardPreview: (format: string): string => `Profile card ${format} preview`,
  cardDescription: (
    level: number,
    standard: number,
    chess960: number,
  ): string =>
    `Your profile card: Level ${formatUngroupedInteger(level)}, Untimed Standard Chess Elo ${formatUngroupedInteger(standard)}, Untimed Chess960 Elo ${formatUngroupedInteger(chess960)}`,
  level: "Level",
  playFree: "Play free at Mapachess.com",
  cardFormats: { GIF: "GIF · Animated", PNG: "PNG · Still" },
  saveToShare: "Save the file to share it with your preferred app.",
  animalCompanion: "Animal companion",
  saveFormat: (format: string): string => `Save ${format}`,
  shareFormat: (format: string): string => `Share ${format}`,
  retryFormat: (format: string): string => `Retry ${format}`,
  preparingFormat: (format: string): string => `Preparing ${format}…`,
  shared: "Shared.",
  shareFailed: "Sharing did not complete. You can retry or save the file.",
  downloadRequested: (format: string): string =>
    `${format} download requested.`,
  downloadFailed:
    "The download could not start. Your card is still ready; try saving again.",
  customization: {
    coach: {
      label: "Coach",
      change: "Change coach",
      done: "Done choosing coach",
    },
    pieces: {
      label: "Pieces",
      change: "Change pieces",
      done: "Done choosing pieces",
    },
    board: {
      label: "Board",
      change: "Change board",
      done: "Done choosing board",
    },
  },
  coachCollections: { mapachito: "Mapachito", greyfox: "Animal faces" },
  dressing: {
    categories: {
      Clothes: "Clothes",
      Weapons: "Weapons",
      Hair: "Hair",
      Skin: "Skin",
      Face: "Face",
      Animal: "Animal",
    },
    choices: (category: string): string => `${category} choices`,
    selection: (category: string): string => `${category} selection`,
    saving: "Saving appearance…",
    unsaved: "Unsaved appearance",
    saved: "Saved appearance",
    weapons: {
      none: "None",
      weapon1: "Sword",
      weapon2: "Spear",
      weapon3: "Wand",
      weapon4: "Axe",
      weapon5: "Dagger",
    },
    weaponColor: (weapon: string, color: number): string =>
      `${weapon} color ${color}`,
    clothingColor: (color: number): string => `Clothing color ${color}`,
    outfit: (id: string): string => `Outfit ${id}`,
    hairColor: (color: number): string => `Hair color ${color}`,
    hairstyle: (id: string): string => `Hairstyle ${id}`,
    skin: (id: number): string => `Skin ${id}`,
    face: (id: number): string => `Face ${id}`,
  },
} as const

export default profile
