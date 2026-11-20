import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
} from "react"
import Home from "@mapachess/application-ui/home"
import type { DurableMatchRecord } from "@mapachess/match/durable-match-record"
import webHomeElements from "./WebHomeElements"

type Props = Omit<
  ComponentProps<typeof Home<Ref<HTMLButtonElement>>>,
  "elements" | "resumePresentation"
> & {
  match: DurableMatchRecord | null
}

export default function WebHome({ match, ...props }: Props) {
  const surface = useRef<HTMLDivElement>(null)
  const [first, setFirst] = useState(false)
  const matchId = match?.matchId
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    const root = surface.current
    if (!matchId || !root) return
    const columns = root.querySelector<HTMLElement>(
      '[data-home-region="columns"]',
    )
    const profile = root.querySelector<HTMLElement>(
      '[data-home-region="profile"]',
    )
    const resume = root.querySelector<HTMLElement>("[data-saved-match]")
    if (!columns || !profile || !resume) return
    if (restoreFocus.current) {
      resume.focus({ preventScroll: true })
      restoreFocus.current = false
    }
    const measure = () => {
      const style = getComputedStyle(columns)
      const naturalBottom =
        columns.getBoundingClientRect().top +
        window.scrollY +
        profile.offsetHeight +
        (parseFloat(style.rowGap) || 0) +
        resume.offsetHeight
      const next =
        style.flexDirection === "column" && naturalBottom > window.innerHeight
      if (first !== next) {
        restoreFocus.current = document.activeElement === resume
        setFirst(next)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(profile)
    observer.observe(resume)
    window.addEventListener("resize", measure)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [first, matchId, props.locale])
  return (
    <div ref={surface}>
      <Home
        {...props}
        elements={webHomeElements}
        resumePresentation={
          match
            ? {
                first,
                label:
                  match.conclusion === null
                    ? props.copy.interface.webGame.resumeMatch
                    : props.copy.interface.matchCelebration.reviewBoard,
                opponent: props.copy.animals.names[match.opponentId],
              }
            : undefined
        }
      />
    </div>
  )
}
