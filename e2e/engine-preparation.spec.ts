import {expect} from "@playwright/test"
import {firstArrivalTest as test} from "./fixtures.js"

test.use({serviceWorkers:"block"})
test("keeps the chess engine off a fresh customization-only journey",async({page})=>{
  const engine:string[]=[]
  page.on("request", request=>{if(request.url().includes("/stockfish-runtime/"))engine.push(request.url())})
  await page.goto("/")
  await page.getByRole("button",{name:"Start",exact:true}).click()
  await page.getByRole("button",{name:"Customize profile card",exact:true}).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  expect(engine).toEqual([])
})
