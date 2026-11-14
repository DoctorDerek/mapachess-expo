import { useState } from "react"
import type { MapachessCatalog } from "@mapachess/localization/catalog"
import {
  importIssueMessage,
  persistenceFailureMessage,
} from "@mapachess/profile/profile-messages"
import type {
  ProfileRecoveryState,
  RecoveryCommands,
  RecoveryFileState,
} from "@mapachess/profile/profile-recovery"
import { PLAYER_RATING_CONTEXTS } from "@mapachess/profile/rating-context"
import { selectStoryCompletion } from "@mapachess/profile/story-progress"
import type { RecoveryElements } from "./recoveryElements.js"

export type ProfileRecoveryProps = Readonly<{
  state: ProfileRecoveryState
  commands: RecoveryCommands
  files: RecoveryFileState
  delivery: "download" | "share"
  copy: MapachessCatalog
  elements: RecoveryElements
}>

function RecoveryFileNotice({
  state,
  files,
  delivery,
  copy,
  elements: { Text },
}: ProfileRecoveryProps) {
  if (files.status !== "failed" && files.status !== "too-large") return null
  const downloadMessage =
    state.kind === "recovery"
      ? copy.interface.profileRecoveryPanel.theDownloadCouldNotBeCreatedYour
      : copy.interface.webMapachessApplication.theDownloadCouldNotBeCreatedYour
  const fileFailureMessage =
    files.operation === "import"
      ? copy.profile.fileUnreadable
      : delivery === "download"
        ? downloadMessage
        : copy.profile.shareFailed
  const message =
    files.status === "too-large"
      ? copy.profile.fileTooLarge
      : fileFailureMessage
  return (
    <Text kind="notice" className="text-mapachito-charcoal mt-5 text-sm">
      {message}
    </Text>
  )
}

function InvalidSaveRecovery(
  props: ProfileRecoveryProps &
    Readonly<{
      state: Extract<ProfileRecoveryState, { kind: "recovery" }>
    }>,
) {
  const {
    state,
    commands,
    files,
    copy,
    elements: { Surface, Group, Text, Action, Import },
  } = props
  const messages = copy.interface.profileRecoveryPanel
  const [confirmingReset, setConfirmingReset] = useState(false)
  const busy = files.status === "busy"
  const cancelReset = (): void => setConfirmingReset(false)
  return (
    <Surface
      kind="recovery"
      title={messages.yourSaveNeedsAttention}
      description={messages.mapachessCouldNotSafelyReadTheCurrent}
      eyebrow={messages.localDataRecovery}
      actions={
        <Action
          className="w-full"
          disabled={busy}
          onActivate={commands.retryLoad}
        >
          {messages.tryAgain}
        </Action>
      }
    >
      <RecoveryFileNotice {...props} />
      {state.importIssue === null ? null : (
        <Text kind="notice" className="text-mapachito-charcoal mt-6 text-sm">
          {importIssueMessage(state.importIssue, copy.profile)}
        </Text>
      )}
      {confirmingReset ? (
        <Surface
          kind="reset"
          title={messages.resetAllLocalPlayerData}
          description={messages.thisReplacesAllLocalPlayerDataIncluding}
          onCancel={cancelReset}
          actions={
            <Group className="flex flex-row flex-wrap gap-3">
              <Action
                className="min-w-0 flex-1"
                variant="secondary"
                focusRequested
                onActivate={cancelReset}
              >
                {messages.cancel}
              </Action>
              <Action
                className="min-w-0 flex-1"
                variant="destructive"
                disabled={busy}
                onActivate={commands.reset}
              >
                {messages.resetAllLocalPlayerData2}
              </Action>
            </Group>
          }
        >
          <RecoveryFileNotice {...props} />
          <Group className="mt-5 flex flex-row flex-wrap gap-3">
            <Action
              variant="secondary"
              disabled={busy}
              onActivate={commands.exportUnreadable}
            >
              {messages.exportUnreadableData}
            </Action>
          </Group>
        </Surface>
      ) : null}
      <Group className="mt-8 flex flex-col gap-4 xl:flex-row xl:flex-wrap">
        <Action
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onActivate={commands.exportUnreadable}
        >
          {messages.exportUnreadableData}
        </Action>
        <Import
          className="flex-1"
          disabled={busy}
          onBackupRead={commands.readBackup}
          onActivate={commands.importData}
        >
          {copy.interface.profileFoundation.importBackup}
        </Import>
        {state.hasLastKnownGood ? (
          <Action
            variant="secondary"
            className="flex-1"
            disabled={busy}
            onActivate={commands.restoreLastKnownGood}
          >
            {messages.restoreLastKnownGoodSave}
          </Action>
        ) : null}
        <Action
          variant="destructive"
          className="flex-1"
          disabled={busy}
          onActivate={() => setConfirmingReset(true)}
        >
          {messages.reviewFullLocalReset}
        </Action>
      </Group>
    </Surface>
  )
}

export default function ProfileRecovery(props: ProfileRecoveryProps) {
  const {
    state,
    commands,
    files,
    copy,
    delivery,
    elements: { Surface, Group, Text, Action },
  } = props
  const application = copy.interface.webMapachessApplication
  switch (state.kind) {
    case "none":
      return null
    case "recovery":
      return <InvalidSaveRecovery {...props} state={state} />
    case "load-failure":
      return (
        <Surface
          kind="load-failure"
          title={application.mapachessCouldNotReadLocalData}
          eyebrow={application.localProfile}
          description={
            delivery === "download"
              ? application.browserStorageDidNotFinishOpeningNothing
              : undefined
          }
          actions={
            <Action focusRequested onActivate={commands.retryLoad}>
              {application.tryAgain}
            </Action>
          }
        />
      )
    case "import-decoding":
      return (
        <Surface
          kind="verification"
          title={application.inspectingBackup}
          description={application.inspectingTheSelectedBackupNothingHasBeen}
          eyebrow={application.playerData}
          onCancel={commands.cancelImport}
          actions={
            <Action
              focusRequested
              variant="secondary"
              onActivate={commands.cancelImport}
            >
              {application.cancelImport}
            </Action>
          }
        />
      )
    case "import-preview": {
      const messages = copy.interface.profileImportPreviewPanel
      const data = state.backup.payload
      const completion = selectStoryCompletion(data.storyProgress)
      const facts = [
        {
          id: "application",
          label: messages.backupApplication,
          value: state.backup.applicationVersion,
        },
        { id: "revision", label: messages.dataRevision, value: data.revision },
        {
          id: "auto-hints",
          label: messages.automaticHints,
          value: copy.setup.autoHints[data.settings.autoHintMode].label,
        },
        {
          id: "active-match",
          label: messages.activeMatch,
          value:
            data.activeMatch === null
              ? copy.profile.none
              : copy.profile.included,
        },
        ...PLAYER_RATING_CONTEXTS.map(
          ({ id, variant, category, assistance }) => ({
            id,
            label: copy.gameplay.clock.rating(
              copy.profile.ratingLabel[variant],
              copy.gameplay.clock.category[category],
              copy.shared.story.medals[assistance],
            ),
            value: Math.round(data.ratings[id]),
          }),
        ),
        {
          id: "legacy",
          label: messages.earlierFourRatings,
          value: messages.preservedInBackup,
        },
        ...(["standard", "chess960", "overall"] as const).map((variant) => ({
          id: variant,
          label: copy.shared.story[variant],
          value: copy.gameplay.storyCompletion(completion[variant]),
        })),
      ]
      return (
        <Surface
          kind="preview"
          title={messages.reviewBeforeReplacingLocalData}
          description={messages.theBackupPassedStructuralAndIntegrityChecks}
          eyebrow={messages.verifiedBackupPreview}
          onCancel={commands.cancelImport}
          actions={
            <Group className="flex flex-row flex-wrap gap-3">
              <Action
                className="min-w-0 flex-1"
                variant="secondary"
                focusRequested
                onActivate={commands.cancelImport}
              >
                {messages.cancelImport}
              </Action>
              <Action
                className="min-w-0 flex-1"
                variant="destructive"
                onActivate={commands.confirmImport}
              >
                {messages.replaceLocalPlayerData}
              </Action>
            </Group>
          }
        >
          <Group
            kind="facts"
            className="text-mapachito-charcoal mt-5 flex min-w-0 flex-col gap-4 text-sm"
          >
            {facts.map(({ id, label, value }) => (
              <Group
                key={id}
                kind="row"
                className="flex min-w-0 flex-row flex-wrap items-start justify-between gap-x-3 gap-y-1"
              >
                <Text
                  kind="label"
                  className="text-mapachito-charcoal min-w-0 flex-1 basis-36 font-black wrap-break-word opacity-72"
                >
                  {label}
                </Text>
                <Text
                  kind="value"
                  className="text-mapachito-charcoal max-w-full min-w-0 text-right font-extrabold wrap-break-word"
                >
                  {value}
                </Text>
              </Group>
            ))}
          </Group>
        </Surface>
      )
    }
    case "persistence-failure": {
      const messages = copy.interface.profilePersistenceFailurePanel
      return (
        <Surface
          kind="save-failure"
          title={copy.interface.localSaveError.localSaveError}
          actions={
            <Group className="mt-6 flex flex-row flex-wrap gap-3">
              <Action
                focusRequested
                busy={state.retrying}
                busyLabel={messages.retryingSave}
                onActivate={commands.retrySave}
              >
                {messages.retrySave}
              </Action>
              {state.canExportData ? (
                <Action
                  variant="secondary"
                  disabled={files.status === "busy"}
                  busy={files.status === "busy" && files.operation === "export"}
                  busyLabel={copy.profile.preparingBackup}
                  onActivate={commands.exportData}
                >
                  {messages.exportPendingPlayerData}
                </Action>
              ) : null}
              {state.canExportUnreadable ? (
                <Action
                  variant="secondary"
                  disabled={files.status === "busy"}
                  onActivate={commands.exportUnreadable}
                >
                  {messages.exportUnreadableData}
                </Action>
              ) : null}
            </Group>
          }
        >
          <Text kind="notice" className="text-mapachito-charcoal mt-5 text-sm">
            {persistenceFailureMessage(state.failure, copy.profile)}{" "}
            {messages.itIsNotYetSavedLaterState}
          </Text>
          <RecoveryFileNotice {...props} />
        </Surface>
      )
    }
  }
}
