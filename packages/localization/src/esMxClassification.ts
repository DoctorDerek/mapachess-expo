import type { MapachessCatalog } from "./catalog.js"

type Thresholds = Parameters<MapachessCatalog["classification"]["table"]>[0]

const classification = {
  headings: ["Clasificación", "Significado"],
  mateHeadings: ["Resultado de mate después de la jugada", "Clasificación"],
  table: (thresholds: Thresholds): readonly (readonly [string, string])[] => [
    [
      "Brillante !!",
      `Una mejora favorable verificada de magnitud excepcional. En una posición ordinaria, la estimación del resultado desde la perspectiva de quien mueve mejora ${thresholds.brilliantGain} puntos porcentuales o más. Si se conserva un mate forzado, quien mueve ahorra dos o más jugadas completas para dar mate respecto a la cuenta regresiva esperada normalizada.`,
    ],
    [
      "Genial !",
      `Una gran mejora favorable verificada. En una posición ordinaria, la estimación del resultado desde la perspectiva de quien mueve mejora al menos ${thresholds.geniusGain}, pero menos de ${thresholds.brilliantGain} puntos porcentuales. Si se conserva un mate forzado, quien mueve ahorra una jugada completa para dar mate respecto a la cuenta regresiva esperada normalizada.`,
    ],
    [
      "La mejor ★",
      "La jugada recomendada por el motor cuando no corresponde una clasificación positiva o negativa más fuerte. Una jugada no tiene que ser La mejor para ser Buena, Genial o Brillante.",
    ],
    [
      "Buena ✓",
      `Una jugada sólida que no alcanza un umbral positivo más fuerte ni un umbral de error. Esto incluye un cambio ordinario en el resultado inferior a ${thresholds.geniusGain} puntos, conservar la posición, un mate forzado que sigue el ritmo esperado o un mate forzado que requiere una jugada completa adicional sin dejar de ser forzado.`,
    ],
    [
      "Imprecisión ?!",
      `Una pérdida ordinaria en el resultado desde la perspectiva de quien mueve de al menos ${thresholds.inaccuracyLoss}, pero menos de ${thresholds.mistakeLoss} puntos; dos jugadas completas adicionales para dar mate mientras quien mueve conserva el mate forzado; o perder un mate forzado verificado con una pérdida en la escala de resultados inferior a ${thresholds.mistakeLoss} puntos.`,
    ],
    [
      "Error ?",
      `Una pérdida ordinaria en el resultado desde la perspectiva de quien mueve de al menos ${thresholds.mistakeLoss}, pero menos de ${thresholds.blunderLoss} puntos; tres o más jugadas completas adicionales para dar mate mientras quien mueve conserva el mate forzado; o perder un mate forzado verificado con una pérdida en la escala de resultados de al menos ${thresholds.mistakeLoss}, pero menos de ${thresholds.blunderLoss} puntos.`,
    ],
    [
      "Error grave ??",
      `Una pérdida ordinaria en el resultado desde la perspectiva de quien mueve de ${thresholds.blunderLoss} puntos o más; o perder un mate forzado verificado con una pérdida en la escala de resultados de ${thresholds.blunderLoss} puntos o más.`,
    ],
  ],
  mateTable: (
    thresholds: Thresholds,
  ): readonly (readonly [string, string])[] => [
    [
      "El mate forzado de quien mueve requiere dos o más jugadas completas menos de lo previsto por la cuenta regresiva normalizada",
      "Brillante !!",
    ],
    ["Quien mueve logra su mate forzado una jugada completa antes", "Genial !"],
    [
      "El mate forzado de quien mueve sigue el ritmo esperado",
      "La mejor ★ si la recomienda el motor; de lo contrario, Buena ✓",
    ],
    [
      "El mate forzado de quien mueve tarda una jugada completa más, pero sigue siendo forzado",
      "Buena ✓",
    ],
    [
      "El mate forzado de quien mueve tarda dos jugadas completas más, pero sigue siendo forzado",
      "Imprecisión ?!",
    ],
    [
      "El mate forzado de quien mueve requiere al menos tres jugadas completas adicionales, pero sigue siendo forzado",
      "Error ?",
    ],
    [
      `Quien mueve pierde un mate forzado verificado y la pérdida restante en el resultado desde su perspectiva es inferior a ${thresholds.mistakeLoss} puntos`,
      "Imprecisión ?!",
    ],
    [
      `Quien mueve pierde un mate forzado verificado y la pérdida restante en el resultado es de al menos ${thresholds.mistakeLoss}, pero menos de ${thresholds.blunderLoss} puntos`,
      "Error ?",
    ],
    [
      `Quien mueve pierde un mate forzado verificado y la pérdida restante en el resultado es de ${thresholds.blunderLoss} puntos o más`,
      "Error grave ??",
    ],
  ],
} as const satisfies MapachessCatalog["classification"]

export default classification
