import { parseChess960PositionId } from "@mapachess/match/chess960-position"
import {
  applyMatchMove,
  listLegalMatchMoves,
} from "@mapachess/match/match-move"
import { reconstructMatchPosition } from "@mapachess/match/match-position"
import type {
  NativeStockfishBestMoveMessage,
  NativeStockfishClosedMessage,
  NativeStockfishConfiguration,
  NativeStockfishFailureMessage,
  NativeStockfishReadyMessage,
  NativeStockfishSearchInformationMessage,
  NativeStockfishSearchRequest,
} from "@mapachess/stockfish-native/native-module"
import type { NativeStockfishBridge } from "@mapachess/stockfish-native/session-binding"

type Listener<Payload> = (message: Payload) => void | Promise<void>

function nativeEvent<Payload>() {
  const listeners = new Set<Listener<Payload>>()
  return {
    emit: (message: Payload): void => {
      for (const listener of listeners) void listener(message)
    },
    subscribe: (listener: Listener<Payload>) => {
      listeners.add(listener)
      return {
        remove: (): void => {
          listeners.delete(listener)
        },
      }
    },
  }
}

export default class NativeEngineFixture implements NativeStockfishBridge {
  private readonly bestMove = nativeEvent<NativeStockfishBestMoveMessage>()
  private readonly closed = nativeEvent<NativeStockfishClosedMessage>()
  private readonly failure = nativeEvent<NativeStockfishFailureMessage>()
  private readonly ready = nativeEvent<NativeStockfishReadyMessage>()
  private readonly information =
    nativeEvent<NativeStockfishSearchInformationMessage>()
  private readonly configurations = new Map<
    string,
    NativeStockfishConfiguration
  >()
  public readonly allocated: string[] = []
  public readonly booted: NativeStockfishConfiguration[] = []
  public readonly closedSessions: string[] = []
  public readonly requests: Readonly<{
    sessionId: string
    request: NativeStockfishSearchRequest
  }>[] = []
  public bootFailure: Readonly<{ ordinal: number; error: Error }> | undefined
  public autoCompleteSearch = true
  public readonly onBestMove = this.bestMove.subscribe
  public readonly onClosed = this.closed.subscribe
  public readonly onFailure = this.failure.subscribe
  public readonly onReady = this.ready.subscribe
  public readonly onSearchInformation = this.information.subscribe

  public createSession(): string {
    const sessionId = "native-fixture/" + String(this.allocated.length + 1)
    this.allocated.push(sessionId)
    return sessionId
  }

  public boot(
    sessionId: string,
    configuration: NativeStockfishConfiguration,
  ): void {
    this.booted.push(configuration)
    if (this.bootFailure?.ordinal === this.booted.length)
      throw this.bootFailure.error
    this.configurations.set(sessionId, configuration)
    this.ready.emit({ sessionId, payload: { version: "Stockfish 18 Lite" } })
  }

  public close(sessionId: string): void {
    this.closedSessions.push(sessionId)
    this.configurations.delete(sessionId)
    this.closed.emit({ sessionId })
  }

  public stop(sessionId: string, requestId: string): void {
    this.bestMove.emit({
      sessionId,
      payload: { requestId, bestMove: "(none)", ponderMove: "" },
    })
  }

  public startSearch(
    sessionId: string,
    request: NativeStockfishSearchRequest,
  ): void {
    this.requests.push({ sessionId, request })
    if (!this.autoCompleteSearch) return
    const configuration = this.configurations.get(sessionId)
    if (configuration === undefined)
      throw new Error("The fixture session must boot.")
    const chess960 = parseChess960PositionId(0)
    if (!chess960.ok) throw new Error("The fixture layout must be valid.")
    const reconstructed = reconstructMatchPosition(
      configuration.isChess960
        ? { variant: "chess960", chess960PositionId: chess960.positionId }
        : { variant: "standard", chess960PositionId: null },
      request.fen,
    )
    if (!reconstructed.ok)
      throw new Error("The fixture position must be valid.")
    let position = reconstructed.position
    for (const uci of request.moves) {
      const move = listLegalMatchMoves(position).find(
        (candidate) => candidate.uci === uci,
      )
      if (move === undefined)
        throw new Error("The fixture received an illegal move.")
      const applied = applyMatchMove(position, move.id)
      if (!applied.ok) throw new Error("The fixture move must apply.")
      position = applied.transition.after
    }
    const moves = [...listLegalMatchMoves(position)].sort((left, right) =>
      left.uci.localeCompare(right.uci),
    )
    for (const [index, move] of moves
      .slice(0, configuration.multiPv)
      .entries()) {
      this.information.emit({
        sessionId,
        payload: {
          bound: "",
          centipawns: 100 - index,
          depth: 8,
          mateMoves: 0,
          nodes: request.nodeLimit,
          principalVariationMoves: [move.uci],
          principalVariationRank: index + 1,
          requestId: request.requestId,
          scoreKind: "centipawns",
          selectiveDepth: 10,
        },
      })
    }
    this.bestMove.emit({
      sessionId,
      payload: {
        requestId: request.requestId,
        bestMove: moves[0]?.uci ?? "(none)",
        ponderMove: "",
      },
    })
  }
}
