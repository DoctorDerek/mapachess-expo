#import <Foundation/Foundation.h>
#import <ReactCommon/CxxTurboModuleUtils.h>

#import "MapachessStockfishModule.h"

@interface MapachessStockfishOnLoad : NSObject
@end

@implementation MapachessStockfishOnLoad

using namespace facebook::react;

+ (void)load {
  registerCxxModuleToGlobalModuleMap(
      std::string(MapachessStockfishModule::kModuleName),
      [](std::shared_ptr<CallInvoker> jsInvoker) {
        return std::make_shared<MapachessStockfishModule>(std::move(jsInvoker));
      });
}

@end
