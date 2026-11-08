#include "StockfishMobileConfig.h"

#if defined(__NO_SYZYGY__)

#include "../third_party/stockfish/src/syzygy/tbprobe.h"

namespace Stockfish::Tablebases {

Config rank_root_moves(const OptionsMap&, Position&, Search::RootMoves&, bool,
                       const std::function<bool()>&) {
  return {};
}

}  // namespace Stockfish::Tablebases

#endif
