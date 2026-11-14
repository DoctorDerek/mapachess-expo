"use client"

import type {
  RecoveryElements,
  RecoverySurfaceProps,
} from "@mapachess/application-ui/recovery-elements"
import LocalSaveError from "@/components/presentation/LocalSaveError"
import MapachessButton from "@/components/presentation/MapachessButton"
import MapachessDialog from "@/components/presentation/MapachessDialog"
import MapachessNotice from "@/components/presentation/MapachessNotice"
import ScrollActions from "@/components/presentation/ScrollActions"
import FullPageProfilePanel, {
  ImportBackupButton,
  ProfileCard,
} from "@/components/profile/ProfileFoundation"

function Surface({
  kind,
  title,
  description,
  eyebrow,
  children,
  actions,
  onCancel,
}: RecoverySurfaceProps) {
  if (kind === "recovery" || kind === "load-failure" || kind === "verification")
    return (
      <FullPageProfilePanel
        title={title}
        description={description ?? ""}
        eyebrow={eyebrow ?? ""}
        live={kind === "verification" ? "polite" : "assertive"}
        actions={actions}
      >
        {children}
      </FullPageProfilePanel>
    )
  const titleId = `profile-${kind}-title`
  const content = (
    <>
      {eyebrow === undefined ? null : (
        <p className="text-mapachito-violet font-mono text-xs leading-[1.3] font-black tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
      )}
      <h2
        id={titleId}
        className="font-display text-mapachito-charcoal mt-3 text-2xl leading-tight font-black text-balance wrap-break-word"
      >
        {kind === "save-failure" ? <LocalSaveError /> : title}
      </h2>
      {description === undefined ? null : (
        <p className="text-mapachito-charcoal mt-5 text-sm leading-[1.55] font-semibold opacity-76">
          {description}
        </p>
      )}
      {children}
    </>
  )
  if (kind === "save-failure")
    return (
      <div className="relative z-30 px-[clamp(1rem,3vw,3rem)] pt-[clamp(1.5rem,3vw,2.5rem)]">
        <ProfileCard labelledBy={titleId}>
          {content}
          {actions}
        </ProfileCard>
      </div>
    )
  const panel = (
    <ProfileCard labelledBy={titleId} className="h-full min-h-0 p-3!">
      <ScrollActions actions={actions}>{content}</ScrollActions>
    </ProfileCard>
  )
  return onCancel === undefined ? (
    panel
  ) : (
    <MapachessDialog label={title} onClose={onCancel} fixedContent>
      {panel}
    </MapachessDialog>
  )
}

const webRecoveryElements = {
  Surface,
  Group: ({ children, className, kind }) =>
    kind === "facts" ? (
      <dl className={className}>{children}</dl>
    ) : (
      <div className={className}>{children}</div>
    ),
  Text: ({ children, className, kind }) => {
    if (kind === "notice")
      return (
        <MapachessNotice tone="warning" className={className} role="alert">
          {children}
        </MapachessNotice>
      )
    return kind === "label" ? (
      <dt className={className}>{children}</dt>
    ) : (
      <dd className={className}>{children}</dd>
    )
  },
  Action: ({ children, onActivate, busy, focusRequested, ...props }) => (
    <MapachessButton
      {...props}
      aria-busy={busy}
      autoFocus={focusRequested}
      onClick={onActivate}
    >
      {children}
    </MapachessButton>
  ),
  Import: ({ children, className, disabled, onBackupRead }) => (
    <ImportBackupButton
      className={className}
      disabled={disabled}
      onBackupRead={onBackupRead}
    >
      {children}
    </ImportBackupButton>
  ),
} satisfies RecoveryElements

export default webRecoveryElements
