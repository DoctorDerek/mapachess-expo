import "./globals.css"
import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Mapachess",
  description:
    "A permanently free, accountless chess game with Better Hints and animal Stockfish opponents.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
