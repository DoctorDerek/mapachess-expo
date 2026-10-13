const pieces = {
  bishop: "bishop",
  king: "king",
  knight: "knight",
  pawn: "pawn",
  queen: "queen",
  rook: "rook",
} as const
const colors = { white: "White", black: "Black" } as const
const owners = { player: "Player", opponent: "Opponent" } as const

const board = {
  pieces,
  colors,
  orientation: (color: keyof typeof colors): string =>
    `Chessboard, ${colors[color]} at bottom`,
  castle: (notation: string, to: string, rookTo: string): string =>
    `Castle ${notation} — king to ${to}, rook to ${rookTo}`,
  moveKing: (to: string): string => `Move king to ${to}`,
  promote: (role: keyof typeof pieces): string => `Promote to ${pieces[role]}`,
  promoteOn: (to: string): string => `Promote on ${to}`,
  chooseMove: (to: string): string => `Choose your move to ${to}`,
  cancelPromotion: "Cancel promotion",
  cancelMove: "Cancel move",
  square: (
    square: string,
    piece:
      | Readonly<{ color: keyof typeof colors; role: keyof typeof pieces }>
      | undefined,
    selected: boolean,
    legalDestination: boolean,
    disabled: boolean,
    hints: readonly string[],
  ): string =>
    [
      square,
      piece === undefined
        ? "empty"
        : `${colors[piece.color]} ${pieces[piece.role]}`,
      ...(selected ? ["selected"] : []),
      ...(legalDestination ? ["legal destination"] : []),
      ...(disabled ? ["board not accepting moves"] : []),
      ...hints,
    ].join(", "),
  pieceHint: (owner: keyof typeof owners): string =>
    `${owners[owner]} Piece Hint`,
  moveHint: (owner: keyof typeof owners, from: string): string =>
    `${owners[owner]} Move Hint destination from ${from}`,
  castleHint: (
    owner: keyof typeof owners,
    side: "king" | "queen",
    to: string,
    rookFrom: string,
    rookTo: string,
  ): string =>
    `${owners[owner]} Move Hint: castle ${side}side, king to ${to}, rook from ${rookFrom} to ${rookTo}`,
  dismissReaction: (
    color: keyof typeof colors,
    notation: string,
    grade: string,
  ): string => `Dismiss ${colors[color]} ${notation} ${grade}`,
  matchAgainst: (mode: string, opponent: string): string =>
    `${mode} match against ${opponent}`,
  versus: " vs. ",
} as const

export default board
