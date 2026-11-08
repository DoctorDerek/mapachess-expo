#pragma once

#include <MapachessStockfishSpecJSI.h>

#include <cstdint>
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

template <typename Payload>
struct MapachessStockfishSessionMessage {
  std::string sessionId;
  Payload payload;
};

struct MapachessStockfishClosedMessage {
  std::string sessionId;
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

template <>
struct Bridging<MapachessStockfishSessionMessage<MapachessStockfishBestMoveEvent>>
    : NativeMapachessStockfishNativeStockfishBestMoveMessageBridging<
          MapachessStockfishSessionMessage<MapachessStockfishBestMoveEvent>> {};

template <>
struct Bridging<MapachessStockfishClosedMessage>
    : NativeMapachessStockfishNativeStockfishClosedMessageBridging<
          MapachessStockfishClosedMessage> {};

template <>
struct Bridging<MapachessStockfishSessionMessage<MapachessStockfishFailureEvent>>
    : NativeMapachessStockfishNativeStockfishFailureMessageBridging<
          MapachessStockfishSessionMessage<MapachessStockfishFailureEvent>> {};

template <>
struct Bridging<MapachessStockfishSessionMessage<MapachessStockfishReadyEvent>>
    : NativeMapachessStockfishNativeStockfishReadyMessageBridging<
          MapachessStockfishSessionMessage<MapachessStockfishReadyEvent>> {};

template <>
struct Bridging<MapachessStockfishSessionMessage<MapachessStockfishSearchInformationEvent>>
    : NativeMapachessStockfishNativeStockfishSearchInformationMessageBridging<
          MapachessStockfishSessionMessage<MapachessStockfishSearchInformationEvent>> {};

class MapachessStockfishModule final
    : public NativeMapachessStockfishCxxSpec<MapachessStockfishModule> {
 public:
  explicit MapachessStockfishModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~MapachessStockfishModule() override;

  std::string createSession(jsi::Runtime& runtime);
  void boot(jsi::Runtime& runtime, std::string sessionId,
            MapachessStockfishConfiguration configuration);
  void close(jsi::Runtime& runtime, std::string sessionId);
  void startSearch(jsi::Runtime& runtime, std::string sessionId,
                   MapachessStockfishSearchRequest request);
  void stop(jsi::Runtime& runtime, std::string sessionId, std::string requestId);

 private:
  class Core;
  class Sessions;

  void emitBestMove(std::string sessionId, MapachessStockfishBestMoveEvent event);
  void emitClosed(std::string sessionId);
  void emitFailure(std::string sessionId, MapachessStockfishFailureEvent event);
  void emitReady(std::string sessionId, MapachessStockfishReadyEvent event);
  void emitSearchInformation(
      std::string sessionId, MapachessStockfishSearchInformationEvent event);

  std::unique_ptr<Sessions> sessions_;
};

}  // namespace facebook::react
