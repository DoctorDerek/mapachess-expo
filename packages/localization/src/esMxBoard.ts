import type { MapachessCatalog } from "./catalog.js"

const pieces = {
  bishop: "alfil",
  king: "rey",
  knight: "caballo",
  pawn: "peón",
  queen: "dama",
  rook: "torre",
} as const
const colors = { white: "Blancas", black: "Negras" } as const
const owners = { player: "jugador", opponent: "oponente" } as const

const board = {
  pieces,
  colors,
  orientation: (color: keyof typeof colors): string =>
    `Tablero de ajedrez, ${colors[color].toLowerCase()} abajo`,
  castle: (notation: string, to: string, rookTo: string): string =>
    `Enroque ${notation} — rey a ${to}, torre a ${rookTo}`,
  moveKing: (to: string): string => `Mover el rey a ${to}`,
  promote: (role: keyof typeof pieces): string =>
    `Promocionar a ${pieces[role]}`,
  promoteOn: (to: string): string => `Promocionar en ${to}`,
  chooseMove: (to: string): string => `Elige tu movimiento a ${to}`,
  cancelPromotion: "Cancelar promoción",
  cancelMove: "Cancelar movimiento",
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
        ? "vacía"
        : `${pieces[piece.role]} de las ${colors[piece.color].toLowerCase()}`,
      ...(selected ? ["seleccionada"] : []),
      ...(legalDestination ? ["destino legal"] : []),
      ...(disabled ? ["el tablero no acepta movimientos"] : []),
      ...hints,
    ].join(", "),
  pieceHint: (owner: keyof typeof owners): string =>
    `Pista de pieza del ${owners[owner]}`,
  moveHint: (owner: keyof typeof owners, from: string): string =>
    `Destino de Pista de movimiento del ${owners[owner]} desde ${from}`,
  castleHint: (
    owner: keyof typeof owners,
    side: "king" | "queen",
    to: string,
    rookFrom: string,
    rookTo: string,
  ): string =>
    `Pista de movimiento del ${owners[owner]}: enroque ${side === "king" ? "corto" : "largo"}, rey a ${to}, torre de ${rookFrom} a ${rookTo}`,
  dismissReaction: (
    color: keyof typeof colors,
    notation: string,
    grade: string,
  ): string =>
    `Cerrar reacción de las ${colors[color].toLowerCase()}: ${notation}, ${grade}`,
  matchAgainst: (mode: string, opponent: string): string =>
    `Partida de ${mode} contra ${opponent}`,
  versus: " contra ",
} as const satisfies MapachessCatalog["board"]

export default board
