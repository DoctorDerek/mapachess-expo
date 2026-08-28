cmake_minimum_required(VERSION 3.13)
project(MapachessStockfish)

set(CMAKE_VERBOSE_MAKEFILE ON)

set(STOCKFISH_SOURCE_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../third_party/stockfish/src")
set(STOCKFISH_NETWORK_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../.stockfish-networks/sf_18")

if(NOT EXISTS "${STOCKFISH_NETWORK_DIRECTORY}/nn-c288c895ea92.nnue")
  message(FATAL_ERROR "The pinned Stockfish big network has not been provisioned.")
endif()

if(NOT EXISTS "${STOCKFISH_NETWORK_DIRECTORY}/nn-37f18f62d772.nnue")
  message(FATAL_ERROR "The pinned Stockfish small network has not been provisioned.")
endif()

set(STOCKFISH_SOURCES
    "${STOCKFISH_SOURCE_DIRECTORY}/benchmark.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/bitboard.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/engine.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/evaluate.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/memory.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/misc.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/movegen.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/movepick.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/nnue/features/full_threats.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/nnue/features/half_ka_v2_hm.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/nnue/network.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/nnue/nnue_accumulator.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/nnue/nnue_misc.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/position.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/score.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/search.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/syzygy/tbprobe.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/thread.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/timeman.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/tt.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/tune.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/uci.cpp"
    "${STOCKFISH_SOURCE_DIRECTORY}/ucioption.cpp"
)

add_library(
    mapachess_stockfish
    STATIC
    ../cpp/MapachessStockfishModule.cpp
    ${STOCKFISH_SOURCES}
)

set_target_properties(
    mapachess_stockfish
    PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)

target_compile_definitions(mapachess_stockfish PRIVATE NDEBUG)
target_compile_options(
    mapachess_stockfish
    PRIVATE
    -O3
    -funroll-loops
    "-include${CMAKE_CURRENT_SOURCE_DIR}/../cpp/StockfishMobileConfig.h"
    "-Wa,-I${STOCKFISH_NETWORK_DIRECTORY}"
)

if(ANDROID_ABI STREQUAL "x86" OR ANDROID_ABI STREQUAL "x86_64")
  target_compile_options(mapachess_stockfish PRIVATE -msse2)
endif()

target_include_directories(
    mapachess_stockfish
    PUBLIC
    ../cpp
    ${STOCKFISH_SOURCE_DIRECTORY}
)

target_link_libraries(
    mapachess_stockfish
    jsi
    reactnative
    react_codegen_MapachessStockfishSpec
)
