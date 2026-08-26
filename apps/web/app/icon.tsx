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
        background: "#07121e",
        color: "#67e8f9",
        display: "flex",
        fontSize: 44,
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
