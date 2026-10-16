import type { MapachessCatalog } from "./catalog.js"

const controls = {
  devices: { controller: "Control", keyboard: "Teclado" },
  focusedControl: "Mediante el elemento enfocado",
  changeBinding: (action: string): string => `Cambiar asignación de ${action}`,
  requiredAction:
    "Ese cambio dejaría una acción necesaria sin asignación en el control. Elige otro botón o dirección.",
  swapQuestion: (action: string | null): string =>
    `Ya está asignado a ${action ?? "otra acción"}. ¿Intercambiar las dos asignaciones?`,
  primary: (control: string | undefined): string =>
    `Principal: ${control ?? "Sin asignar"}`,
  alternate: (control: string | undefined): string =>
    `Alternativa: ${control ?? "Sin asignar"}`,
  prompt: (control: string, action: string): string => `${control}: ${action}`,
  keys: {
    ArrowUp: "Arriba",
    ArrowDown: "Abajo",
    ArrowLeft: "Izquierda",
    ArrowRight: "Derecha",
    Enter: "Enter",
    Escape: "Escape",
    Space: "Espacio",
    BracketLeft: "[",
    BracketRight: "]",
    Comma: "Coma",
    Period: "Punto",
    Slash: "Barra diagonal",
    Backslash: "Barra invertida",
    Semicolon: "Punto y coma",
    Quote: "Comilla",
    Minus: "Menos",
    Equal: "Igual",
    Home: "Inicio",
    End: "Fin",
    PageUp: "RePág",
    PageDown: "AvPág",
  },
} as const satisfies MapachessCatalog["controls"]

export default controls
