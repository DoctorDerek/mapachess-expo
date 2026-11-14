import { useEffect, useRef, type ReactNode, type Ref } from "react"
import type {
  HomeActionProps,
  HomeElements,
  HomeGroupProps,
  HomeSettingsProps,
  HomeTextProps,
} from "@mapachess/application-ui/home-elements"
import MapachessButton from "@/components/presentation/MapachessButton"
import MapachessWordmark from "@/components/presentation/MapachessWordmark"
import ProfileAction from "@/components/profile/ProfileAction"
import { webProfileCardElements } from "@/components/profile/ProfileCard"

function Surface({
  children,
  className,
}: Readonly<{ children: ReactNode; className: string }>) {
  return (
    <section aria-labelledby="game-modes-title" className={className}>
      {children}
    </section>
  )
}

function Group({ children, className, region }: HomeGroupProps) {
  if (region === "header")
    return <header className={className}>{children}</header>
  return region === "mode-label" ? (
    <span className={className}>{children}</span>
  ) : (
    <div className={className}>{children}</div>
  )
}

function Title({ label }: Readonly<{ label: string }>) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [])
  return (
    <h1
      id="game-modes-title"
      aria-label={label}
      ref={heading}
      tabIndex={-1}
      className="min-w-0 outline-none"
    >
      <MapachessWordmark />
    </h1>
  )
}

function Text({
  children,
  className,
  emphasis = false,
  decorative = false,
}: HomeTextProps) {
  return emphasis ? (
    <strong className={className}>{children}</strong>
  ) : (
    <span aria-hidden={decorative || undefined} className={className}>
      {children}
    </span>
  )
}

function Action({
  children,
  className,
  disabled,
  onActivate,
  label,
  kind,
}: HomeActionProps) {
  if (kind === "resume")
    return (
      <MapachessButton
        className={className}
        disabled={disabled}
        onClick={onActivate}
      >
        {children}
      </MapachessButton>
    )
  return (
    <ProfileAction
      size={kind === "mode" ? "home-mode" : "home-card"}
      aria-label={label}
      className={className}
      disabled={disabled}
      onClick={onActivate}
    >
      {children}
    </ProfileAction>
  )
}

function Settings({
  children,
  disabled,
  expanded,
  focusTarget,
  onActivate,
}: HomeSettingsProps<Ref<HTMLButtonElement>>) {
  return (
    <MapachessButton
      variant="secondary"
      type="button"
      ref={focusTarget}
      aria-controls="profile-settings-panel"
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onActivate}
      className="max-w-full min-w-0 wrap-break-word"
    >
      {children}
    </MapachessButton>
  )
}

const webHomeElements: HomeElements<Ref<HTMLButtonElement>> = {
  Surface,
  Group,
  Title,
  Text,
  Action,
  Settings,
  card: webProfileCardElements,
}

export default webHomeElements
