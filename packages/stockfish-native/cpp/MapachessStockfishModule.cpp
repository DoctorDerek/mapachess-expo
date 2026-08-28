#include "MapachessStockfishModule.h"

#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <deque>
#include <functional>
#include <limits>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>
#include <type_traits>
#include <utility>
#include <variant>

#include "engine.h"
#include "misc.h"
#include "score.h"
#include "search.h"

namespace facebook::react {
namespace {

constexpr double kMaximumJavaScriptSafeInteger = 9007199254740991.0;

enum class EngineState {
  Created,
  Booting,
  Ready,
  Searching,
  Stopping,
  Closing,
  Closed,
  Failed,
};

struct BootCommand {
  MapachessStockfishConfiguration configuration;
};

struct CloseCommand {};

struct SearchCommand {
  MapachessStockfishSearchRequest request;
};

struct StopCommand {
  std::string requestId;
};

using EngineCommand =
    std::variant<BootCommand, CloseCommand, SearchCommand, StopCommand>;

struct ConvertedScore {
  int centipawns;
  int mateMoves;
  std::string kind;
};

bool containsControlCharacter(std::string_view value) {
  for (const unsigned char character : value) {
    if (character <= 0x1f || character == 0x7f) {
      return true;
    }
  }

  return false;
}

bool isStableText(std::string_view value) {
  return !value.empty() && value.front() != ' ' && value.back() != ' ' &&
         !containsControlCharacter(value);
}

bool isValidUciMove(std::string_view move) {
  if (move.size() != 4 && move.size() != 5) {
    return false;
  }

  const auto isFile = [](char value) { return value >= 'a' && value <= 'h'; };
  const auto isRank = [](char value) { return value >= '1' && value <= '8'; };

  if (!isFile(move[0]) || !isRank(move[1]) || !isFile(move[2]) ||
      !isRank(move[3])) {
    return false;
  }

  if (move.size() == 4) {
    return true;
  }

  return move[4] == 'q' || move[4] == 'r' || move[4] == 'b' ||
         move[4] == 'n';
}

ConvertedScore convertScore(const Stockfish::Score& score) {
  return score.visit([](const auto value) -> ConvertedScore {
    using ScoreValue = std::decay_t<decltype(value)>;

    if constexpr (std::is_same_v<ScoreValue, Stockfish::Score::Mate>) {
      const int moves = (value.plies > 0 ? value.plies + 1 : value.plies) / 2;
      return {.centipawns = 0, .mateMoves = moves, .kind = "mate"};
    } else if constexpr (
        std::is_same_v<ScoreValue, Stockfish::Score::Tablebase>) {
      constexpr int tablebaseCentipawns = 20000;
      const int centipawns = value.win ? tablebaseCentipawns - value.plies
                                       : -tablebaseCentipawns - value.plies;
      return {
          .centipawns = centipawns,
          .mateMoves = 0,
          .kind = "centipawns",
      };
    } else {
      return {
          .centipawns = value.value,
          .mateMoves = 0,
          .kind = "centipawns",
      };
    }
  });
}

std::string requestIdForCommand(const EngineCommand& command) {
  return std::visit(
      [](const auto& value) -> std::string {
        using Command = std::decay_t<decltype(value)>;
        if constexpr (std::is_same_v<Command, SearchCommand>) {
          return value.request.requestId;
        } else if constexpr (std::is_same_v<Command, StopCommand>) {
          return value.requestId;
        }
        return {};
      },
      command);
}

void validateConfiguration(
    const MapachessStockfishConfiguration& configuration) {
  if (configuration.threads <= 0 || configuration.hashMegabytes <= 0 ||
      configuration.multiPv <= 0) {
    throw std::invalid_argument(
        "Threads, hash size, and MultiPV must be positive integers.");
  }

  if (configuration.limitStrength &&
      (configuration.elo < Stockfish::Search::Skill::LowestElo ||
       configuration.elo > Stockfish::Search::Skill::HighestElo)) {
    throw std::invalid_argument(
        "UCI Elo must be within Stockfish's supported range.");
  }
}

void validateSearchRequest(const MapachessStockfishSearchRequest& request) {
  if (!isStableText(request.requestId)) {
    throw std::invalid_argument("The search request ID is invalid.");
  }

  if (!isStableText(request.fen)) {
    throw std::invalid_argument("The search FEN is invalid.");
  }

  if (!std::isfinite(request.nodeLimit) || request.nodeLimit <= 0 ||
      std::floor(request.nodeLimit) != request.nodeLimit ||
      request.nodeLimit > kMaximumJavaScriptSafeInteger) {
    throw std::invalid_argument(
        "The node limit must be a positive JavaScript-safe integer.");
  }

  for (const std::string& move : request.moves) {
    if (!isValidUciMove(move)) {
      throw std::invalid_argument("The move list contains an invalid UCI move.");
    }
  }
}

}  // namespace

class MapachessStockfishModule::Core {
 public:
  struct Callbacks {
    std::function<void(MapachessStockfishBestMoveEvent)> bestMove;
    std::function<void()> closed;
    std::function<void(MapachessStockfishFailureEvent)> failure;
    std::function<void(MapachessStockfishReadyEvent)> ready;
    std::function<void(MapachessStockfishSearchInformationEvent)>
        searchInformation;
  };

  explicit Core(Callbacks callbacks)
      : callbacks_(std::move(callbacks)), worker_([this] { run(); }) {}

  ~Core() { shutdown(); }

  bool boot(MapachessStockfishConfiguration configuration) {
    return enqueue(BootCommand{.configuration = configuration});
  }

  bool close() {
    {
      std::lock_guard lock(queueMutex_);
      if (closeQueued_) {
        return true;
      }
      closeQueued_ = true;
      commands_.emplace_back(CloseCommand{});
    }
    commandAvailable_.notify_one();
    return true;
  }

  bool search(MapachessStockfishSearchRequest request) {
    return enqueue(SearchCommand{.request = std::move(request)});
  }

  bool stop(std::string requestId) {
    return enqueue(StopCommand{.requestId = std::move(requestId)});
  }

  void shutdown() {
    close();
    if (worker_.joinable()) {
      worker_.join();
    }
  }

 private:
  bool enqueue(EngineCommand command) {
    {
      std::lock_guard lock(queueMutex_);
      if (closeQueued_) {
        return false;
      }
      commands_.emplace_back(std::move(command));
    }
    commandAvailable_.notify_one();
    return true;
  }

  void run() {
    while (true) {
      EngineCommand command = nextCommand();
      const bool closesEngine = std::holds_alternative<CloseCommand>(command);

      try {
        std::visit([this](auto&& value) { handle(std::move(value)); }, command);
      } catch (const std::exception& error) {
        fail("native-engine-error", error.what(), requestIdForCommand(command));
        if (closesEngine) {
          completeClose();
        }
      } catch (...) {
        fail("native-engine-error", "The native engine failed unexpectedly.",
             requestIdForCommand(command));
        if (closesEngine) {
          completeClose();
        }
      }

      if (closesEngine) {
        return;
      }
    }
  }

  EngineCommand nextCommand() {
    std::unique_lock lock(queueMutex_);
    commandAvailable_.wait(lock, [this] { return !commands_.empty(); });
    EngineCommand command = std::move(commands_.front());
    commands_.pop_front();
    return command;
  }

  void handle(BootCommand command) {
    if (!transition(EngineState::Created, EngineState::Booting)) {
      emitFailure("invalid-state", "The native engine can only boot once.", "");
      return;
    }

    engine_ = std::make_unique<Stockfish::Engine>();
    installEngineCallbacks();
    applyConfiguration(command.configuration);
    engine_->verify_networks();

    {
      std::lock_guard lock(stateMutex_);
      state_ = EngineState::Ready;
    }
    callbacks_.ready(
        {.version = std::string(Stockfish::engine_version_info())});
  }

  void handle(CloseCommand) {
    {
      std::lock_guard lock(stateMutex_);
      if (state_ == EngineState::Closed) {
        return;
      }
      state_ = EngineState::Closing;
    }

    if (engine_) {
      engine_->stop();
      engine_->wait_for_search_finished();
      engine_.reset();
    }

    completeClose();
  }

  void handle(SearchCommand command) {
    if (state() != EngineState::Ready || !engine_) {
      emitFailure("invalid-state",
                  "The native engine must be ready before a search.",
                  command.request.requestId);
      return;
    }

    validateSearchRequest(command.request);
    {
      std::lock_guard lock(stateMutex_);
      activeRequestId_ = command.request.requestId;
      state_ = EngineState::Searching;
    }

    engine_->set_position(command.request.fen, command.request.moves);
    Stockfish::Search::LimitsType limits;
    limits.nodes = static_cast<std::uint64_t>(command.request.nodeLimit);
    limits.startTime = Stockfish::now();
    engine_->go(limits);
  }

  void handle(StopCommand command) {
    bool shouldStop = false;
    {
      std::lock_guard lock(stateMutex_);
      if (state_ == EngineState::Searching &&
          activeRequestId_ == command.requestId) {
        state_ = EngineState::Stopping;
        shouldStop = true;
      }
    }

    if (!shouldStop || !engine_) {
      emitFailure("invalid-stop",
                  "The stop request did not match the active native search.",
                  command.requestId);
      return;
    }

    engine_->stop();
  }

  void installEngineCallbacks() {
    engine_->set_on_update_no_moves(
        [this](const Stockfish::Engine::InfoShort& information) {
          emitSearchInformation(information.depth, 0, 0, information.score, "");
        });
    engine_->set_on_update_full(
        [this](const Stockfish::Engine::InfoFull& information) {
          emitSearchInformation(
              information.depth, information.selDepth, information.nodes,
              information.score, std::string(information.bound));
        });
    engine_->set_on_iter([](const Stockfish::Engine::InfoIter&) {});
    engine_->set_on_bestmove(
        [this](std::string_view bestMove, std::string_view ponderMove) {
          std::string requestId;
          {
            std::lock_guard lock(stateMutex_);
            if (activeRequestId_.empty() || state_ == EngineState::Failed ||
                state_ == EngineState::Closed) {
              return;
            }
            requestId = std::move(activeRequestId_);
            activeRequestId_.clear();
            if (state_ == EngineState::Searching ||
                state_ == EngineState::Stopping) {
              state_ = EngineState::Ready;
            }
          }

          callbacks_.bestMove({
              .bestMove = std::string(bestMove),
              .ponderMove = std::string(ponderMove),
              .requestId = std::move(requestId),
          });
        });
    engine_->set_on_verify_networks([](std::string_view) {});
  }

  void emitSearchInformation(int depth, int selectiveDepth, std::size_t nodes,
                             const Stockfish::Score& score,
                             std::string bound) {
    std::string requestId;
    {
      std::lock_guard lock(stateMutex_);
      if (state_ != EngineState::Searching || activeRequestId_.empty()) {
        return;
      }
      requestId = activeRequestId_;
    }

    ConvertedScore convertedScore = convertScore(score);
    callbacks_.searchInformation({
        .bound = std::move(bound),
        .centipawns = convertedScore.centipawns,
        .depth = depth,
        .mateMoves = convertedScore.mateMoves,
        .nodes = static_cast<double>(nodes),
        .requestId = std::move(requestId),
        .scoreKind = std::move(convertedScore.kind),
        .selectiveDepth = selectiveDepth,
    });
  }

  void applyConfiguration(
      const MapachessStockfishConfiguration& configuration) {
    validateConfiguration(configuration);
    setIntegerOption("Threads", configuration.threads);
    setIntegerOption("Hash", configuration.hashMegabytes);
    setIntegerOption("MultiPV", configuration.multiPv);
    setBooleanOption("Ponder", configuration.ponder);
    setBooleanOption("UCI_Chess960", configuration.isChess960);
    setBooleanOption("UCI_LimitStrength", configuration.limitStrength);
    if (configuration.limitStrength) {
      setIntegerOption("UCI_Elo", configuration.elo);
    }
    engine_->search_clear();
  }

  void setBooleanOption(std::string_view name, bool value) {
    setOption(name, value ? "true" : "false");
    if (static_cast<int>(engine_->get_options()[std::string(name)]) !=
        static_cast<int>(value)) {
      throw std::invalid_argument("Stockfish rejected a boolean option.");
    }
  }

  void setIntegerOption(std::string_view name, int value) {
    setOption(name, std::to_string(value));
    if (static_cast<int>(engine_->get_options()[std::string(name)]) != value) {
      throw std::invalid_argument("Stockfish rejected an integer option.");
    }
  }

  void setOption(std::string_view name, const std::string& value) {
    std::istringstream command("name " + std::string(name) + " value " + value);
    engine_->get_options().setoption(command);
  }

  bool transition(EngineState expected, EngineState next) {
    std::lock_guard lock(stateMutex_);
    if (state_ != expected) {
      return false;
    }
    state_ = next;
    return true;
  }

  EngineState state() const {
    std::lock_guard lock(stateMutex_);
    return state_;
  }

  void fail(std::string code, std::string message, std::string requestId) {
    std::string activeRequestId;
    {
      std::lock_guard lock(stateMutex_);
      activeRequestId = activeRequestId_;
      activeRequestId_.clear();
      state_ = EngineState::Failed;
    }

    if (engine_) {
      engine_->stop();
      engine_->wait_for_search_finished();
      engine_.reset();
    }

    if (requestId.empty()) {
      requestId = std::move(activeRequestId);
    }
    emitFailure(std::move(code), std::move(message), std::move(requestId));
  }

  void completeClose() {
    {
      std::lock_guard lock(stateMutex_);
      activeRequestId_.clear();
      state_ = EngineState::Closed;
    }
    callbacks_.closed();
  }

  void emitFailure(std::string code, std::string message,
                   std::string requestId) {
    callbacks_.failure({
        .code = std::move(code),
        .message = std::move(message),
        .requestId = std::move(requestId),
    });
  }

  Callbacks callbacks_;
  std::condition_variable commandAvailable_;
  std::deque<EngineCommand> commands_;
  bool closeQueued_ = false;
  mutable std::mutex queueMutex_;
  std::thread worker_;

  std::string activeRequestId_;
  std::unique_ptr<Stockfish::Engine> engine_;
  EngineState state_ = EngineState::Created;
  mutable std::mutex stateMutex_;
};

MapachessStockfishModule::MapachessStockfishModule(
    std::shared_ptr<CallInvoker> jsInvoker)
    : NativeMapachessStockfishCxxSpec(std::move(jsInvoker)),
      core_(std::make_unique<Core>(Core::Callbacks{
          .bestMove = [this](MapachessStockfishBestMoveEvent event) {
            emitBestMove(std::move(event));
          },
          .closed = [this] { emitClosed(); },
          .failure = [this](MapachessStockfishFailureEvent event) {
            emitFailure(std::move(event));
          },
          .ready = [this](MapachessStockfishReadyEvent event) {
            emitReady(std::move(event));
          },
          .searchInformation =
              [this](MapachessStockfishSearchInformationEvent event) {
                emitSearchInformation(std::move(event));
              },
      })) {}

MapachessStockfishModule::~MapachessStockfishModule() {
  core_->shutdown();
}

void MapachessStockfishModule::boot(
    jsi::Runtime&, MapachessStockfishConfiguration configuration) {
  if (!core_->boot(configuration)) {
    emitFailure({.code = "closed",
                 .message = "The native engine is closing or closed.",
                 .requestId = ""});
  }
}

void MapachessStockfishModule::close(jsi::Runtime&) {
  core_->close();
}

void MapachessStockfishModule::startSearch(
    jsi::Runtime&, MapachessStockfishSearchRequest request) {
  const std::string requestId = request.requestId;
  if (!core_->search(std::move(request))) {
    emitFailure({.code = "closed",
                 .message = "The native engine is closing or closed.",
                 .requestId = requestId});
  }
}

void MapachessStockfishModule::stop(jsi::Runtime&, std::string requestId) {
  const std::string retainedRequestId = requestId;
  if (!core_->stop(std::move(requestId))) {
    emitFailure({.code = "closed",
                 .message = "The native engine is closing or closed.",
                 .requestId = retainedRequestId});
  }
}

void MapachessStockfishModule::emitBestMove(
    MapachessStockfishBestMoveEvent event) {
  emitOnBestMove(std::move(event));
}

void MapachessStockfishModule::emitClosed() {
  emitOnClosed();
}

void MapachessStockfishModule::emitFailure(
    MapachessStockfishFailureEvent event) {
  emitOnFailure(std::move(event));
}

void MapachessStockfishModule::emitReady(
    MapachessStockfishReadyEvent event) {
  emitOnReady(std::move(event));
}

void MapachessStockfishModule::emitSearchInformation(
    MapachessStockfishSearchInformationEvent event) {
  emitOnSearchInformation(std::move(event));
}

}  // namespace facebook::react
