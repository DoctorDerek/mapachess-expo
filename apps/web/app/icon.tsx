import { ImageResponse } from "next/og"

export const size = {
  width: 64,
  height: 64,
}

export const contentType = "image/png"

const MAPACHITO_DEEP_GOLD = "#a77e18"
const MAPACHITO_CHARCOAL = "#1e1e1e"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: MAPACHITO_DEEP_GOLD,
        border: `6px solid ${MAPACHITO_CHARCOAL}`,
        color: MAPACHITO_CHARCOAL,
        display: "flex",
        fontFamily: "Arial Black, sans-serif",
        fontSize: 40,
        fontWeight: 900,
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      M
    </div>,
    size,
  )
}
