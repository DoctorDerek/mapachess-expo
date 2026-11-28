import { createHash } from "node:crypto"
import { expect, type Locator, type Page } from "@playwright/test"
import provenance from "../ghost_assets/chess-assets.provenance.json" with { type: "json" }

const digests = new Map(
  provenance.files.map((file) => [file.runtime, file.sha256]),
)

export async function expectChessMember(image: Locator, member: string) {
  const digest = digests.get(member)
  if (!digest) throw new Error("Missing chess appearance fixture.")
  await expect(image).toHaveAttribute("data-chess-art", member)
  await expect
    .poll(async () => {
      const source = await image.getAttribute("src")
      const prefix = member.endsWith(".svg")
        ? "data:image/svg+xml;base64,"
        : "data:image/png;base64,"
      return source?.startsWith(prefix)
        ? createHash("sha256")
            .update(Buffer.from(source.slice(prefix.length), "base64"))
            .digest("hex")
        : null
    })
    .toBe(digest)
}

export async function holdChessMember(page: Page, member: string) {
  const digest = digests.get(member)
  if (!digest) throw new Error("Missing chess decode fixture.")
  const entered = Promise.withResolvers<void>()
  const failure = Promise.withResolvers<void>()
  let retry = false
  await page.exposeFunction("acceptChessDecode", async () => {
    if (retry) return true
    entered.resolve()
    await failure.promise
    return false
  })
  await page.addInitScript((expected) => {
    const decode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = async function () {
      if (/^data:image\/(?:png|svg\+xml);base64,/.test(this.src)) {
        const bytes = Uint8Array.from(
          atob(this.src.slice(this.src.indexOf(",") + 1)),
          (value) => value.charCodeAt(0),
        )
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes),
        )
        if (
          Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
            "",
          ) === expected &&
          "acceptChessDecode" in window &&
          typeof window.acceptChessDecode === "function" &&
          !(await window.acceptChessDecode())
        )
          throw new Error("Controlled chess image decode failure.")
      }
      return decode.call(this)
    }
  }, digest)
  return {
    async fail() {
      await entered.promise
      failure.resolve()
    },
    allowRetry() {
      retry = true
    },
  }
}
