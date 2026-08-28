require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |specification|
  specification.name = "MapachessStockfish"
  specification.version = package["version"]
  specification.summary = package["description"]
  specification.homepage = package["homepage"]
  specification.license = package["license"]
  specification.authors = package["author"]

  specification.platforms = { :ios => min_ios_version_supported }
  specification.source = {
    :git => "https://github.com/DoctorDerek/mapachess-expo.git",
    :tag => specification.version.to_s,
  }

  specification.source_files =
    "ios/OnLoad.mm",
    "cpp/**/*.{h,hpp,cpp}",
    "ios/generated/**/*.{h,cpp,mm}",
    "third_party/stockfish/src/**/*.{h,hpp,cpp}"
  specification.exclude_files = "third_party/stockfish/src/main.cpp"
  specification.private_header_files = "ios/**/*.h"

  specification.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "OTHER_CPLUSPLUSFLAGS" => [
      "$(inherited)",
      "-O3",
      "-funroll-loops",
      "-DNDEBUG",
      "-include\"$(PODS_TARGET_SRCROOT)/cpp/StockfishMobileConfig.h\"",
      "-Wa,-I$(PODS_TARGET_SRCROOT)/.stockfish-networks/sf_18",
    ].join(" "),
  }

  install_modules_dependencies(specification)
end
