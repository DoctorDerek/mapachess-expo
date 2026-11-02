const setup = {
  menuTitle: "Choose your game",
  menuDescription: "Play your way. Better Hints are always within reach.",
  allModes: "All game modes",
  opponent: "Opponent",
  color: "Play as",
  white: "White",
  black: "Black",
  random: "Random",
  randomize: "Randomize",
  pinnedPosition: "This position is remembered until you choose Randomize.",
  freshPosition:
    "Each new setup gets a random position number. Start match uses the number shown.",
  randomColor: "Your side is chosen at random when the match starts.",
  position: "Chess960 starting position",
  positionNumber: (maximum: number): string => `Position number (0–${maximum})`,
  invalidSetup:
    "Choose an available animal, difficulty, side, and valid starting position.",
  difficulty: "Difficulty · estimated Elo",
  difficultyLabel: "Difficulty",
  estimated: "Estimated Elo",
  unavailableSelection:
    "This selection is not available. Choose an earned animal and supported difficulty.",
  untimed: "Untimed",
  webCalibrationDifficulty:
    "These difficulty estimates are calibrated against a controlled engine pool, not certified human ratings.",
  storyAvailability:
    "Defeat each opponent to unlock the next in this Story ladder. Replay earlier victories to improve your medal.",
  challengeAvailability:
    "Beat an animal in either Story mode to unlock it in Challenge.",
  startMatch: "Start match",
  openingMatch: "Opening match…",
  restartingMatch: "Restarting match…",
  returningToMenu: "Returning to menu…",
  change: "Change",
  done: "Done",
  accept: "Accept",
  cancel: "Cancel",
  customizeProfile: "Customize profile card",
  shareProfile: "Share profile card",
  chooseAnimal: "Choose animal",
  chooseOpponent: "Choose opponent",
  chooseDifficulty: "Choose difficulty",
  changeAnimal: "Change animal",
  changeStoryOpponent: "Change Story opponent",
  changeDifficulty: "Change difficulty",
  changeHints: "Change hints",
  playAsAction: (animal: string): string => `Play as ${animal} · Change animal`,
  elo: (value: string): string => `${value} Elo`,
  bestMedal: (medal: string): string => ` · Best medal: ${medal}`,
  lastPlayed: (opponent: string): string => ` · Last played: ${opponent}`,
  difficultyMedals:
    "Best medal at this difficulty: Gold (no hints), Silver (Piece Hints only), Bronze (Move Hints allowed). The animal is your last played opponent, not your next selection.",
  variants: { standard: "Standard Chess", chess960: "Chess960" },
  modes: { story: "Story", challenge: "Challenge" },
  presentations: {
    standard: {
      story: {
        title: "Standard Chess Story",
        description:
          "The classic starting position. Your side is chosen at random.",
      },
      challenge: {
        title: "Standard Chess Challenge",
        description:
          "The classic starting position. Choose White, Black, or Random.",
      },
    },
    chess960: {
      story: {
        title: "Chess960 Story",
        description: "A fresh starting position and a randomly chosen side.",
      },
      challenge: {
        title: "Chess960 Challenge",
        description:
          "Choose your side and a random or numbered starting position.",
      },
    },
  },
  betterHints: "Better Hints",
  autoHints: {
    "auto-move-hints": {
      label: "Auto Move Hints",
      description:
        "Automatically show three Piece Hints and their Move Hints for each side.",
      medal: "Bronze if you win after using Move Hints.",
    },
    "auto-piece-hints": {
      label: "Auto Piece Hints",
      description:
        "Automatically show three Piece Hints for each side. Request their Move Hints on your turn.",
      medal: "Silver if you win with Piece Hints but no Move Hints.",
    },
    "no-auto-hints": {
      label: "No Auto Hints",
      description:
        "On your turn, request three Piece Hints for each side, then their Move Hints.",
      medal: "Gold if you win without using any hints.",
    },
  },
  hintMedalExplanation:
    "Medals reflect hints actually shown during the match. Changing this setting never erases earlier hint use.",
} as const

export default setup
