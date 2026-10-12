import {
  CONTROLLER_CONTROL_LABELS,
  type ControllerControl,
} from "@mapachess/match/player-input"

export type ControllerFamily =
  | "generic"
  | "steam-deck"
  | "xbox"
  | "playstation4"
  | "playstation5"
  | "nintendo"
export type PlayerInputDevice =
  | Readonly<{ method: "pointer" | "touch" | "keyboard" }>
  | Readonly<{ method: "controller"; family: ControllerFamily }>

export function controllerFamily(id: string): ControllerFamily {
  if (/steam\s*deck/i.test(id)) return "steam-deck"
  if (/xbox/i.test(id)) return "xbox"
  if (/dualsense|054c[^a-f0-9]+0ce6/i.test(id)) return "playstation5"
  if (/dualshock\s*4|054c[^a-f0-9]+(05c4|09cc)/i.test(id)) return "playstation4"
  if (/nintendo|switch pro/i.test(id)) return "nintendo"
  return "generic"
}

const generic = {
  south: "Nintendo Switch/Default/switch_buttons_down.png",
  east: "Nintendo Switch/Default/switch_buttons_right.png",
  west: "Nintendo Switch/Default/switch_buttons_left.png",
  north: "Nintendo Switch/Default/switch_buttons_up.png",
  leftShoulder: "PlayStation Series/Default/playstation_trigger_l1.png",
  rightShoulder: "PlayStation Series/Default/playstation_trigger_r1.png",
  leftTrigger: "PlayStation Series/Default/playstation_trigger_l2.png",
  rightTrigger: "PlayStation Series/Default/playstation_trigger_r2.png",
  view: "Xbox Series/Default/xbox_button_view.png",
  menu: "Xbox Series/Default/xbox_button_menu.png",
  leftStick: "Generic/Default/generic_stick_press.png",
  rightStick: "Generic/Default/generic_stick_press.png",
  dpadUp: "Nintendo Switch/Default/switch_dpad_up.png",
  dpadDown: "Nintendo Switch/Default/switch_dpad_down.png",
  dpadLeft: "Nintendo Switch/Default/switch_dpad_left.png",
  dpadRight: "Nintendo Switch/Default/switch_dpad_right.png",
  stickUp: "Generic/Default/generic_stick_up.png",
  stickDown: "Generic/Default/generic_stick_down.png",
  stickLeft: "Generic/Default/generic_stick_left.png",
  stickRight: "Generic/Default/generic_stick_right.png",
} as const satisfies Readonly<Record<ControllerControl, string>>

const playstation = {
  ...generic,
  south: "PlayStation Series/Default/playstation_button_cross.png",
  east: "PlayStation Series/Default/playstation_button_circle.png",
  west: "PlayStation Series/Default/playstation_button_square.png",
  north: "PlayStation Series/Default/playstation_button_triangle.png",
  leftStick: "PlayStation Series/Default/playstation_button_l3.png",
  rightStick: "PlayStation Series/Default/playstation_button_r3.png",
} as const

export const CONTROLLER_GLYPHS = {
  generic,
  "steam-deck": {
    ...generic,
    south: "Steam Deck/Default/steamdeck_button_a.png",
    east: "Steam Deck/Default/steamdeck_button_b.png",
    west: "Steam Deck/Default/steamdeck_button_x.png",
    north: "Steam Deck/Default/steamdeck_button_y.png",
    leftShoulder: "Steam Deck/Default/steamdeck_button_l1.png",
    rightShoulder: "Steam Deck/Default/steamdeck_button_r1.png",
    leftTrigger: "Steam Deck/Default/steamdeck_button_l2.png",
    rightTrigger: "Steam Deck/Default/steamdeck_button_r2.png",
    menu: "Steam Deck/Default/steamdeck_button_options.png",
    view: "Steam Deck/Default/steamdeck_button_view.png",
    leftStick: "Steam Deck/Default/steamdeck_stick_l_press.png",
    rightStick: "Steam Deck/Default/steamdeck_stick_r_press.png",
  },
  xbox: {
    ...generic,
    south: "Xbox Series/Default/xbox_button_a.png",
    east: "Xbox Series/Default/xbox_button_b.png",
    west: "Xbox Series/Default/xbox_button_x.png",
    north: "Xbox Series/Default/xbox_button_y.png",
    leftShoulder: "Xbox Series/Default/xbox_lb.png",
    rightShoulder: "Xbox Series/Default/xbox_rb.png",
    leftTrigger: "Xbox Series/Default/xbox_lt.png",
    rightTrigger: "Xbox Series/Default/xbox_rt.png",
    leftStick: "Xbox Series/Default/xbox_ls.png",
    rightStick: "Xbox Series/Default/xbox_rs.png",
  },
  playstation4: {
    ...playstation,
    menu: "PlayStation Series/Default/playstation4_button_options.png",
    view: "PlayStation Series/Default/playstation4_button_share.png",
  },
  playstation5: {
    ...playstation,
    menu: "PlayStation Series/Default/playstation5_button_options.png",
    view: "PlayStation Series/Default/playstation5_button_create.png",
  },
  nintendo: {
    ...generic,
    south: "Nintendo Switch/Default/switch_button_b.png",
    east: "Nintendo Switch/Default/switch_button_a.png",
    west: "Nintendo Switch/Default/switch_button_y.png",
    north: "Nintendo Switch/Default/switch_button_x.png",
    leftShoulder: "Nintendo Switch/Default/switch_button_l.png",
    rightShoulder: "Nintendo Switch/Default/switch_button_r.png",
    leftTrigger: "Nintendo Switch/Default/switch_button_zl.png",
    rightTrigger: "Nintendo Switch/Default/switch_button_zr.png",
    menu: "Nintendo Switch/Default/switch_button_plus.png",
    view: "Nintendo Switch/Default/switch_button_minus.png",
  },
} as const satisfies Readonly<
  Record<ControllerFamily, Readonly<Record<ControllerControl, string>>>
>

export function controllerPrompt(
  family: ControllerFamily,
  control: ControllerControl,
): Readonly<{ source: string; label: string }> {
  const source = CONTROLLER_GLYPHS[family][control]
  return {
    source: `/input-prompts/${source.slice(source.lastIndexOf("/") + 1)}`,
    label: CONTROLLER_CONTROL_LABELS[control],
  }
}
