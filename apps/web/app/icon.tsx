import { ImageResponse } from "next/og"

export const size = {
  width: 64,
  height: 64,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#ffd84d",
        border: "6px solid #1c1036",
        color: "#1c1036",
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
