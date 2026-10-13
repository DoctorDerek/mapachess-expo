const controls = {
  devices: { controller: "Controller", keyboard: "Keyboard" },
  focusedControl: "Via focused control",
  changeBinding: (action: string): string => `Change ${action} binding`,
  requiredAction:
    "That change would leave a required action unbound. Choose another control.",
  swapQuestion: (action: string | null): string =>
    `Already assigned to ${action ?? "another action"}. Swap the two bindings?`,
  primary: (control: string | undefined): string =>
    `Primary: ${control ?? "Not assigned"}`,
  alternate: (control: string | undefined): string =>
    `Alternate: ${control ?? "Not assigned"}`,
  prompt: (control: string, action: string): string => `${control}: ${action}`,
  keys: {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Enter: "Enter",
    Escape: "Escape",
    Space: "Space",
    BracketLeft: "[",
    BracketRight: "]",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    Backslash: "Backslash",
    Semicolon: "Semicolon",
    Quote: "Quote",
    Minus: "Minus",
    Equal: "Equal",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  },
} as const

export default controls
