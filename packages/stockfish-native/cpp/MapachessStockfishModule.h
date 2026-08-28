#pragma once

#include <MapachessStockfishSpecJSI.h>

#include <memory>
#include <string>
#include <vector>

namespace facebook::react {

struct MapachessStockfishConfiguration {
  int elo;
  int hashMegabytes;
  bool isChess960;
  bool limitStrength;
  int multiPv;
  bool ponder;
  int threads;
};

struct MapachessStockfishSearchRequest {
  std::string fen;
  std::vector<std::string> moves;
  double nodeLimit;
  std::string requestId;
};

struct MapachessStockfishReadyEvent {
  std::string version;
};

struct MapachessStockfishSearchInformationEvent {
  std::string bound;
  int centipawns;
  int depth;
  int mateMoves;
  double nodes;
  std::string requestId;
  std::string scoreKind;
  int selectiveDepth;
};

struct MapachessStockfishBestMoveEvent {
  std::string bestMove;
  std::string ponderMove;
  std::string requestId;
};

struct MapachessStockfishFailureEvent {
  std::string code;
  std::string message;
  std::string requestId;
};

template <>
struct Bridging<MapachessStockfishConfiguration>
    : NativeMapachessStockfishNativeStockfishConfigurationBridging<
          MapachessStockfishConfiguration> {};

template <>
struct Bridging<MapachessStockfishSearchRequest>
    : NativeMapachessStockfishNativeStockfishSearchRequestBridging<
          MapachessStockfishSearchRequest> {};

template <>
struct Bridging<MapachessStockfishReadyEvent>
    : NativeMapachessStockfishNativeStockfishReadyEventBridging<
          MapachessStockfishReadyEvent> {};

template <>
struct Bridging<MapachessStockfishSearchInformationEvent>
    : NativeMapachessStockfishNativeStockfishSearchInformationEventBridging<
          MapachessStockfishSearchInformationEvent> {};

template <>
struct Bridging<MapachessStockfishBestMoveEvent>
    : NativeMapachessStockfishNativeStockfishBestMoveEventBridging<
          MapachessStockfishBestMoveEvent> {};

template <>
struct Bridging<MapachessStockfishFailureEvent>
    : NativeMapachessStockfishNativeStockfishFailureEventBridging<
          MapachessStockfishFailureEvent> {};

class MapachessStockfishModule final
    : public NativeMapachessStockfishCxxSpec<MapachessStockfishModule> {
 public:
  explicit MapachessStockfishModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~MapachessStockfishModule() override;

  void boot(jsi::Runtime& runtime);
  void close(jsi::Runtime& runtime);
  void configure(jsi::Runtime& runtime,
                 MapachessStockfishConfiguration configuration);
  void startSearch(jsi::Runtime& runtime,
                   MapachessStockfishSearchRequest request);
  void stop(jsi::Runtime& runtime, std::string requestId);

 private:
  class Core;

  void emitBestMove(MapachessStockfishBestMoveEvent event);
  void emitClosed();
  void emitFailure(MapachessStockfishFailureEvent event);
  void emitReady(MapachessStockfishReadyEvent event);
  void emitSearchInformation(MapachessStockfishSearchInformationEvent event);

  std::unique_ptr<Core> core_;
};

}  // namespace facebook::react
