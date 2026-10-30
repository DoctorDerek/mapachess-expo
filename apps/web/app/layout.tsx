import "./globals.css"
import type { Metadata } from "next"
import localFont from "next/font/local"
import type { ReactNode } from "react"
import loadCatalog from "@mapachess/localization/catalog"
import WebsiteAnalytics from "../components/WebsiteAnalytics"

const homeFont = localFont({
  src: "../public/fonts/nunito-sans/latin-wght.woff2",
  variable: "--font-nunito-sans",
  weight: "200 900",
  style: "normal",
  display: "swap",
  fallback: ["Trebuchet MS", "Arial", "sans-serif"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://mapachess.com"),
  title: "Mapachess | Free Chess vs. Stockfish With Better Hints",
  description: loadCatalog("en").presentation.metadataDescription,
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={homeFont.variable}>
      <body>
        {children}
        {process.env.VERCEL_ENV === "production" && <WebsiteAnalytics />}
      </body>
    </html>
  )
}
