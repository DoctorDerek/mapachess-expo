package expo.modules.mapachessinput

import android.content.Context
import android.hardware.input.InputManager
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.widget.EditText
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class MapachessInputModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MapachessInput")
    Events("onInput")
    View(MapachessInputView::class) { Events("onInput") }
  }
}

class MapachessInputView(context: Context, appContext: AppContext) : ExpoView(context, appContext), InputManager.InputDeviceListener {
  private val onInput by EventDispatcher()
  private val inputManager = context.getSystemService(Context.INPUT_SERVICE) as InputManager
  private val held = mutableMapOf<Int, DoubleArray>()
  private val analogButtons = mutableMapOf<Int, DoubleArray>()
  private val axes = mutableMapOf<Int, DoubleArray>()
  private val gamepadKeys = mapOf(
    KeyEvent.KEYCODE_BUTTON_A to 0, KeyEvent.KEYCODE_BUTTON_B to 1,
    KeyEvent.KEYCODE_BUTTON_X to 2, KeyEvent.KEYCODE_BUTTON_Y to 3,
    KeyEvent.KEYCODE_BUTTON_L1 to 4, KeyEvent.KEYCODE_BUTTON_R1 to 5,
    KeyEvent.KEYCODE_BUTTON_L2 to 6, KeyEvent.KEYCODE_BUTTON_R2 to 7,
    KeyEvent.KEYCODE_BUTTON_SELECT to 8, KeyEvent.KEYCODE_BUTTON_START to 9,
    KeyEvent.KEYCODE_BUTTON_THUMBL to 10, KeyEvent.KEYCODE_BUTTON_THUMBR to 11,
    KeyEvent.KEYCODE_DPAD_UP to 12, KeyEvent.KEYCODE_DPAD_DOWN to 13,
    KeyEvent.KEYCODE_DPAD_LEFT to 14, KeyEvent.KEYCODE_DPAD_RIGHT to 15,
  )
  init { isFocusable = true; isFocusableInTouchMode = true }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); inputManager.registerInputDeviceListener(this, null); if (!hasFocus()) requestFocus() }
  override fun onDetachedFromWindow() { inputManager.unregisterInputDeviceListener(this); held.clear(); analogButtons.clear(); axes.clear(); super.onDetachedFromWindow() }
  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (!hasWindowFocus) { held.clear(); analogButtons.clear(); axes.clear(); onInput(mapOf("kind" to "reset")) }
  }
  private fun controller(device: InputDevice) {
    val digital = held[device.id] ?: DoubleArray(16)
    val analog = analogButtons[device.id] ?: DoubleArray(16)
    onInput(mapOf("kind" to "controller", "id" to device.id.toString(), "name" to device.name,
      "buttons" to List(16) { index -> maxOf(digital[index], analog[index]) }, "axes" to (axes[device.id] ?: DoubleArray(2)).toList()))
  }
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val device = event.device
    val gamepad = device != null && (device.supportsSource(InputDevice.SOURCE_GAMEPAD) || device.supportsSource(InputDevice.SOURCE_JOYSTICK)) && gamepadKeys.containsKey(event.keyCode)
    if (gamepad) {
      val index = gamepadKeys[event.keyCode] ?: return super.dispatchKeyEvent(event)
      if (event.action == KeyEvent.ACTION_DOWN || event.action == KeyEvent.ACTION_UP) {
        held.getOrPut(event.deviceId) { DoubleArray(16) }[index] = if (event.action == KeyEvent.ACTION_DOWN) 1.0 else 0.0
        controller(device!!)
      }
      return true
    }
    val code = keyboardCode(event.keyCode) ?: return super.dispatchKeyEvent(event)
    if (findFocus() is EditText && code != "Escape") return super.dispatchKeyEvent(event)
    if (event.isCtrlPressed || event.isAltPressed || event.isMetaPressed) return super.dispatchKeyEvent(event)
    if (event.action == KeyEvent.ACTION_DOWN || event.action == KeyEvent.ACTION_UP) {
      onInput(mapOf("kind" to "keyboard", "code" to code, "pressed" to (event.action == KeyEvent.ACTION_DOWN), "repeat" to (event.repeatCount > 0)))
      return true
    }
    return super.dispatchKeyEvent(event)
  }
  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
    val device = event.device ?: return super.dispatchGenericMotionEvent(event)
    if (!event.isFromSource(InputDevice.SOURCE_JOYSTICK)) return super.dispatchGenericMotionEvent(event)
    axes[event.deviceId] = doubleArrayOf(event.getAxisValue(MotionEvent.AXIS_X).toDouble(), event.getAxisValue(MotionEvent.AXIS_Y).toDouble())
    val buttons = analogButtons.getOrPut(event.deviceId) { DoubleArray(16) }
    buttons[6] = event.getAxisValue(MotionEvent.AXIS_LTRIGGER).toDouble()
    buttons[7] = event.getAxisValue(MotionEvent.AXIS_RTRIGGER).toDouble()
    val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
    val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
    buttons[12] = if (hatY < -0.5f) 1.0 else 0.0; buttons[13] = if (hatY > 0.5f) 1.0 else 0.0
    buttons[14] = if (hatX < -0.5f) 1.0 else 0.0; buttons[15] = if (hatX > 0.5f) 1.0 else 0.0
    controller(device)
    return true
  }
  override fun onInputDeviceAdded(deviceId: Int) { InputDevice.getDevice(deviceId)?.let { if (it.supportsSource(InputDevice.SOURCE_GAMEPAD) || it.supportsSource(InputDevice.SOURCE_JOYSTICK)) controller(it) } }
  override fun onInputDeviceChanged(deviceId: Int) { held.remove(deviceId); analogButtons.remove(deviceId); axes.remove(deviceId); onInputDeviceAdded(deviceId) }
  override fun onInputDeviceRemoved(deviceId: Int) { held.remove(deviceId); analogButtons.remove(deviceId); axes.remove(deviceId); onInput(mapOf("kind" to "disconnect", "id" to deviceId.toString())) }
  private fun keyboardCode(key: Int): String? = when (key) {
    in KeyEvent.KEYCODE_A..KeyEvent.KEYCODE_Z -> "Key" + ('A'.code + key - KeyEvent.KEYCODE_A).toChar()
    in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 -> "Digit" + (key - KeyEvent.KEYCODE_0).toString()
    KeyEvent.KEYCODE_DPAD_UP -> "ArrowUp"; KeyEvent.KEYCODE_DPAD_DOWN -> "ArrowDown"
    KeyEvent.KEYCODE_DPAD_LEFT -> "ArrowLeft"; KeyEvent.KEYCODE_DPAD_RIGHT -> "ArrowRight"
    KeyEvent.KEYCODE_ENTER -> "Enter"; KeyEvent.KEYCODE_ESCAPE -> "Escape"; KeyEvent.KEYCODE_SPACE -> "Space"
    KeyEvent.KEYCODE_LEFT_BRACKET -> "BracketLeft"; KeyEvent.KEYCODE_RIGHT_BRACKET -> "BracketRight"
    KeyEvent.KEYCODE_COMMA -> "Comma"; KeyEvent.KEYCODE_PERIOD -> "Period"; KeyEvent.KEYCODE_SLASH -> "Slash"
    KeyEvent.KEYCODE_BACKSLASH -> "Backslash"; KeyEvent.KEYCODE_SEMICOLON -> "Semicolon"; KeyEvent.KEYCODE_APOSTROPHE -> "Quote"
    KeyEvent.KEYCODE_MINUS -> "Minus"; KeyEvent.KEYCODE_EQUALS -> "Equal"; KeyEvent.KEYCODE_MOVE_HOME -> "Home"
    KeyEvent.KEYCODE_MOVE_END -> "End"; KeyEvent.KEYCODE_PAGE_UP -> "PageUp"; KeyEvent.KEYCODE_PAGE_DOWN -> "PageDown"
    else -> null
  }
}
