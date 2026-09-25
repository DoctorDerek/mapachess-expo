import "./globals.css"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import WebsiteAnalytics from "../components/WebsiteAnalytics"

export const metadata: Metadata = {
  metadataBase: new URL("https://mapachess.com"),
  title: "Mapachess",
  description:
    "A permanently free, accountless chess game with Better Hints and animal Stockfish opponents.",
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.VERCEL_ENV === "production" && <WebsiteAnalytics />}
      </body>
    </html>
  )
}
