import { once } from "node:events"
import { createServer } from "node:http"
import type { APIRequestContext } from "@playwright/test"

// A stopped origin exercises the real service worker, including in WebKit where
// driver-level offline emulation can reject navigation before the worker runs.
export default async function startOrigin(
  upstream: string,
  request: APIRequestContext,
) {
  const server = createServer(async (input, output) => {
    try {
      if (
        !input.url?.startsWith("/") ||
        input.url.startsWith("//") ||
        input.method !== "GET"
      ) {
        output.writeHead(405).end()
        return
      }
      const local = new URL(input.url, "http://127.0.0.1")
      const destination = new URL(upstream)
      destination.pathname = local.pathname
      destination.search = local.search
      const response = await request.get(destination.href, { maxRedirects: 0 })
      try {
        const headers = response.headers()
        output
          .writeHead(response.status(), {
            "Content-Type":
              headers["content-type"] ?? "application/octet-stream",
            "Cache-Control": headers["cache-control"] ?? "no-cache",
          })
          .end(await response.body())
      } finally {
        await response.dispose()
      }
    } catch {
      output.destroy()
    }
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string")
    throw Error("Expected a TCP test origin")
  return {
    url: "http://127.0.0.1:" + address.port,
    close: async () => {
      if (!server.listening) return
      const closed = once(server, "close")
      server.close()
      server.closeAllConnections()
      await closed
    },
  }
}
