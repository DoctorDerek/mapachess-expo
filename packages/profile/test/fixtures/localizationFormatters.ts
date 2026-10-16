import type { MapachessCatalog } from "../../../localization/src/catalog.js"

type FormatterPaths<Value> = {
  [Key in keyof Value & string]: Value[Key] extends (
    ...parameters: never[]
  ) => unknown
    ? Key
    : Value[Key] extends string | readonly unknown[]
      ? never
      : `${Key}.${FormatterPaths<Value[Key]>}`
}[keyof Value & string]

type AtPath<
  Value,
  Path extends string,
> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Value
    ? AtPath<Value[Head], Tail>
    : never
  : Path extends keyof Value
    ? Value[Path]
    : never

type FormatterExamples = {
  readonly [Path in FormatterPaths<MapachessCatalog>]: AtPath<
    MapachessCatalog,
    Path
  > extends (...parameters: infer Parameters) => unknown
    ? readonly (readonly [...Parameters])[]
    : never
}

const formatterExamples = {
  "setup.positionNumber": [[959]],
  "setup.playAsAction": [["Raccoon"]],
  "setup.elo": [["1201"]],
  "setup.bestMedal": [["Gold"]],
  "setup.lastPlayed": [["Chicken Stockfish"]],
  "profile.ratedMatches": [[0], [1], [23]],
  "profile.rating": [["Standard Chess", 1200.5]],
  "profile.resetRating": [["Standard Chess"]],
  "profile.resetQuestion": [["Standard Chess"]],
  "profile.resetExplanation": [["Standard Chess"]],
  "profile.resetConfirmation": [["Standard Chess"]],
  "profile.artworkPreview": [["Chessnut", "Classic"]],
  "profile.cardPreview": [["PNG"]],
  "profile.cardDescription": [[1, 1200.5, 1200.5]],
  "profile.saveFormat": [["PNG"]],
  "profile.shareFormat": [["PNG"]],
  "profile.retryFormat": [["PNG"]],
  "profile.preparingFormat": [["PNG"]],
  "profile.downloadRequested": [["PNG"]],
  "profile.dressing.choices": [["Clothes"]],
  "profile.dressing.selection": [["Clothes"]],
  "profile.dressing.weaponColor": [["Sword", 1]],
  "profile.dressing.clothingColor": [[1]],
  "profile.dressing.outfit": [["1"]],
  "profile.dressing.hairColor": [[1]],
  "profile.dressing.hairstyle": [["1"]],
  "profile.dressing.skin": [[1]],
  "profile.dressing.face": [[1]],
  "controls.changeBinding": [["Confirm"]],
  "controls.swapQuestion": [["Confirm"], [null]],
  "controls.primary": [["Enter"], [undefined]],
  "controls.alternate": [["Space"], [undefined]],
  "controls.prompt": [["Enter", "Confirm"]],
  "gameplay.integer": [[0], [1], [1000]],
  "gameplay.elo": [[445.21238123123], [1200.5], [0], [-1]],
  "gameplay.storyCompletion": [[0], [12.345], [100]],
  "gameplay.defeatedCount": [
    [0, 23],
    [1, 23],
    [23, 23],
  ],
  "gameplay.nextUnlocked": [["Chicken Stockfish"]],
  "gameplay.lockedOpponent": [[1]],
  "gameplay.targetElo": [[1200.5]],
  "gameplay.defeatedMedal": [["Gold"]],
  "gameplay.challengeList": [
    [["Chicken Stockfish"]],
    [["Chicken Stockfish", "War Hero Stockfish", "Dragonfly Stockfish"]],
  ],
  "gameplay.conclusion.opponentWon": [["Chicken Stockfish"]],
  "gameplay.conclusion.opponentResigned": [["Chicken Stockfish"]],
  "gameplay.conclusion.playerResigned": [["Chicken Stockfish"]],
  "gameplay.defeatedOpponent": [["Chicken Stockfish"]],
  "gameplay.opponentAndElo": [["Chicken Stockfish", 1200.5]],
  "gameplay.awardedXp": [[1]],
  "gameplay.level": [[1]],
  "gameplay.xpProgress": [
    [0, 2000],
    [1, 2000],
    [1000, 2000],
  ],
  "gameplay.levelProgress": [[1, 1, 2000]],
  "gameplay.levelAchievement": [[1]],
  "gameplay.achievementUnlocked": [["First win"]],
  "gameplay.bestMedal": [["Gold"]],
  "gameplay.challengeUnlocked": [["Chicken Stockfish"]],
  "gameplay.storyDefeated": [[23]],
  "gameplay.opponentMoveInvalid": [["Chicken Stockfish"]],
  "gameplay.opponentTurnFailed": [["Chicken Stockfish"]],
  "gameplay.retryTurn": [["Chicken Stockfish"], ["War Hero Stockfish"]],
  "gameplay.drawDeclined": [["Chicken Stockfish"]],
  "gameplay.hints.piecesShown": [
    [[], []],
    [["e1"], ["e8"]],
    [
      ["e2", "d2", "g1"],
      ["e7", "d7", "g8"],
    ],
  ],
  "gameplay.hints.movesShown": [
    [[], []],
    [["e1 to d1"], ["e8 to d8"]],
    [
      ["e2 to e4", "d2 to d4", "g1 to f3"],
      ["e7 to e5", "d7 to d5", "g8 to f6"],
    ],
  ],
  "gameplay.hints.move": [["e2", "e4"]],
  "gameplay.hints.castle": [
    ["king", "g1", "h1", "f1"],
    ["queen", "c1", "a1", "d1"],
  ],
  "animals.opponent": [["chicken-stockfish"]],
  "board.orientation": [["white"]],
  "board.castle": [
    ["O-O", "g1", "f1"],
    ["O-O-O", "c1", "d1"],
  ],
  "board.moveKing": [["e4"]],
  "board.promote": [["queen"], ["knight"]],
  "board.promoteOn": [["e8"]],
  "board.chooseMove": [["e4"]],
  "board.square": [
    ["e2", { color: "white", role: "pawn" }, true, true, false, ["Piece Hint"]],
    ["e4", undefined, false, false, false, []],
  ],
  "board.pieceHint": [["player"]],
  "board.moveHint": [["player", "e2"]],
  "board.castleHint": [
    ["player", "king", "g1", "h1", "f1"],
    ["opponent", "queen", "c8", "a8", "d8"],
  ],
  "board.dismissReaction": [["white", "e4", "Good"]],
  "board.matchAgainst": [["Story", "Chicken Stockfish"]],
  "evaluation.whiteRelative": [["+1.00"]],
  "evaluation.mate": [
    ["white", 0, "exact"],
    ["black", 3, "lower"],
    ["white", 2, "upper"],
  ],
  "evaluation.centipawns": [
    [0, "exact"],
    [-125, "lower"],
    [125, "upper"],
  ],
  "classification.table": [
    [
      {
        brilliantGain: 10,
        geniusGain: 5,
        inaccuracyLoss: 5,
        mistakeLoss: 10,
        blunderLoss: 20,
      },
    ],
  ],
  "classification.mateTable": [
    [
      {
        brilliantGain: 10,
        geniusGain: 5,
        inaccuracyLoss: 5,
        mistakeLoss: 10,
        blunderLoss: 20,
      },
    ],
  ],
  "presentation.coach": [["GreyFox"]],
  "presentation.fighter": [["Raccoon", "idle"]],
  "presentation.unavailableFighter": [["Raccoon"]],
  "presentation.ready": [["Chicken Stockfish"]],
  "presentation.capture": [["Raccoon", "Chicken Stockfish"]],
  "presentation.check": [["Raccoon", "Chicken Stockfish"]],
  "presentation.victory": [["Raccoon"]],
} as const satisfies FormatterExamples

export default formatterExamples
