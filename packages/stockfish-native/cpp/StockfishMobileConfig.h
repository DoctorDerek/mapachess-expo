#pragma once

#include <cstdint>

#if INTPTR_MAX == INT64_MAX
    #define IS_64BIT
#endif

#define USE_PTHREADS

#if defined(__aarch64__) || defined(__arm64__) || defined(_M_ARM64)
    #define USE_NEON 8
    #define USE_POPCNT
#elif defined(__arm__) || defined(_M_ARM)
    #define USE_NEON 7
    #define USE_POPCNT
#elif defined(__x86_64__) || defined(__i386__) || defined(_M_X64) || defined(_M_IX86)
    #define USE_SSE2
#else
    #define NO_PREFETCH
#endif
