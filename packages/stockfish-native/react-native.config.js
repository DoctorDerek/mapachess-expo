/** @type {import('@react-native-community/cli-types').UserDependencyConfig} */
export default {
  dependency: {
    platforms: {
      android: {
        cmakeListsPath: "generated/jni/CMakeLists.txt",
        cxxModuleCMakeListsModuleName: "mapachess_stockfish",
        cxxModuleCMakeListsPath: "CMakeLists.txt",
        cxxModuleHeaderName: "MapachessStockfishModule",
      },
    },
  },
}
