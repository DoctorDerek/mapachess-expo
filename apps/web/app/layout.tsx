import "./globals.css"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import loadCatalog from "@mapachess/localization/catalog"
import WebsiteAnalytics from "../components/WebsiteAnalytics"

export const metadata: Metadata = {
  metadataBase: new URL("https://mapachess.com"),
  title: "Mapachess",
  description: loadCatalog("en").presentation.metadataDescription,
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
