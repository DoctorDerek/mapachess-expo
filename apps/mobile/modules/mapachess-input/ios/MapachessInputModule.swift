import ExpoModulesCore
import GameController

public class MapachessInputModule: Module {
  private var observers: [NSObjectProtocol] = []
  public func definition() -> ModuleDefinition {
    Name("MapachessInput")
    Events("onInput")
    OnStartObserving { self.start() }
    OnStopObserving { self.stop() }
    OnDestroy { self.stop() }
  }
  private func start() {
    stop()
    let center = NotificationCenter.default
    observers = [
      center.addObserver(forName: .GCControllerDidConnect, object: nil, queue: .main) { [weak self] notification in
        if let controller = notification.object as? GCController { self?.bind(controller) }
      },
      center.addObserver(forName: .GCControllerDidDisconnect, object: nil, queue: .main) { [weak self] notification in
        if let controller = notification.object as? GCController { self?.sendEvent("onInput", ["kind": "disconnect", "id": String(describing: ObjectIdentifier(controller))]) }
      },
      center.addObserver(forName: .GCKeyboardDidConnect, object: nil, queue: .main) { [weak self] _ in self?.bindKeyboard() },
      center.addObserver(forName: .GCKeyboardDidDisconnect, object: nil, queue: .main) { [weak self] _ in self?.sendEvent("onInput", ["kind": "reset"]) }
    ]
    GCController.controllers().forEach { bind($0) }
    bindKeyboard()
  }
  private func stop() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
    GCController.controllers().forEach { $0.extendedGamepad?.valueChangedHandler = nil }
    GCKeyboard.coalesced?.keyboardInput?.keyChangedHandler = nil
  }
  private func bind(_ controller: GCController) {
    guard let pad = controller.extendedGamepad else { return }
    pad.valueChangedHandler = { [weak self, weak controller] pad, _ in
      guard let controller else { return }
      self?.publish(controller, pad)
    }
    publish(controller, pad)
  }
  private func publish(_ controller: GCController, _ pad: GCExtendedGamepad) {
    let buttons: [Float] = [pad.buttonA.value, pad.buttonB.value, pad.buttonX.value, pad.buttonY.value,
      pad.leftShoulder.value, pad.rightShoulder.value, pad.leftTrigger.value, pad.rightTrigger.value,
      pad.buttonOptions?.value ?? 0, pad.buttonMenu.value, pad.leftThumbstickButton?.value ?? 0, pad.rightThumbstickButton?.value ?? 0,
      pad.dpad.up.value, pad.dpad.down.value, pad.dpad.left.value, pad.dpad.right.value]
    sendEvent("onInput", ["kind": "controller", "id": String(describing: ObjectIdentifier(controller)), "name": controller.vendorName ?? "Controller", "buttons": buttons, "axes": [pad.leftThumbstick.xAxis.value, -pad.leftThumbstick.yAxis.value]])
  }
  private func bindKeyboard() {
    GCKeyboard.coalesced?.keyboardInput?.keyChangedHandler = { [weak self] keyboard, _, key, pressed in
      guard let code = self?.keyboardCode(Int(key.rawValue)) else { return }
      if keyboard.button(forKeyCode: .leftControl)?.isPressed == true || keyboard.button(forKeyCode: .rightControl)?.isPressed == true || keyboard.button(forKeyCode: .leftGUI)?.isPressed == true || keyboard.button(forKeyCode: .rightGUI)?.isPressed == true || keyboard.button(forKeyCode: .leftAlt)?.isPressed == true || keyboard.button(forKeyCode: .rightAlt)?.isPressed == true { return }
      self?.sendEvent("onInput", ["kind": "keyboard", "code": code, "pressed": pressed, "repeat": false])
    }
  }
  private func keyboardCode(_ key: Int) -> String? {
    if (4...29).contains(key), let letter = UnicodeScalar(key - 4 + 65) { return "Key" + String(Character(letter)) }
    if (30...38).contains(key) { return "Digit" + String(key - 29) }
    let codes = [39: "Digit0", 40: "Enter", 41: "Escape", 44: "Space", 45: "Minus", 46: "Equal", 47: "BracketLeft", 48: "BracketRight", 49: "Backslash", 51: "Semicolon", 52: "Quote", 54: "Comma", 55: "Period", 56: "Slash", 74: "Home", 75: "PageUp", 77: "End", 78: "PageDown", 79: "ArrowRight", 80: "ArrowLeft", 81: "ArrowDown", 82: "ArrowUp"]
    return codes[key]
  }
}

