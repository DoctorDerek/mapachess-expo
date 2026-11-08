import { useState } from "react"
import { View } from "react-native"
import {
  selectCurrentPlayerData,
  selectHasLastKnownGoodSave,
  selectImportIssue,
  selectImportPreview,
  selectPersistenceFailure,
} from "@mapachess/profile/profile-machine"
import {
  importIssueMessage,
  persistenceFailureMessage,
} from "@mapachess/profile/profile-messages"
import type { ProfileActor } from "@mapachess/profile/profile-runtime"
import { PLAYER_RATING_CONTEXTS } from "@mapachess/profile/rating-context"
import { selectStoryCompletion } from "@mapachess/profile/story-progress"
import type useNativeFileActions from "@/lib/profile/useNativeFileActions"
import useActorSnapshot from "@/lib/useActorSnapshot"
import NativeButton from "../presentation/NativeButton"
import NativePanel from "../presentation/NativePanel"
import NativeText from "../presentation/NativeText"
import { useNativeLocale } from "./NativeLocaleProvider"

export default function NativeProfileRecovery({
  actor,
  files,
}: Readonly<{
  actor: ProfileActor
  files: ReturnType<typeof useNativeFileActions>
}>) {
  const { copy } = useNativeLocale()
  const snapshot = useActorSnapshot(actor)
  const [confirmReset, setConfirmReset] = useState(false)
  const preview = selectImportPreview(snapshot)
  const recovery = snapshot.matches("recovery")
  const failed = selectPersistenceFailure(snapshot)
  const messages = copy.interface.profileRecoveryPanel
  const cancelImport = () => actor.send({ type: "PROFILE.IMPORT_CANCELLED" })
  if (preview !== null && snapshot.matches("importPreview")) {
    const labels = copy.interface.profileImportPreviewPanel
    const completion = selectStoryCompletion(preview.payload.storyProgress)
    return (
      <NativePanel
        title={labels.reviewBeforeReplacingLocalData}
        onBack={cancelImport}
        actions={
          <View className="flex-row gap-2">
            <NativeButton
              variant="secondary"
              className="flex-1"
              onPress={cancelImport}
            >
              {labels.cancelImport}
            </NativeButton>
            <NativeButton
              variant="destructive"
              className="flex-1"
              onPress={() => actor.send({ type: "PROFILE.IMPORT_CONFIRMED" })}
            >
              {labels.replaceLocalPlayerData}
            </NativeButton>
          </View>
        }
      >
        <NativeText>
          {labels.theBackupPassedStructuralAndIntegrityChecks}
        </NativeText>
        <NativeText>
          {labels.backupApplication}: {preview.applicationVersion}
        </NativeText>
        <NativeText>
          {labels.dataRevision}: {preview.payload.revision}
        </NativeText>
        <NativeText>
          {labels.activeMatch}:{" "}
          {preview.payload.activeMatch === null
            ? copy.profile.none
            : copy.profile.included}
        </NativeText>
        {PLAYER_RATING_CONTEXTS.map(({ id, variant, category, assistance }) => (
          <NativeText key={id}>
            {copy.gameplay.clock.rating(
              copy.profile.ratingLabel[variant],
              copy.gameplay.clock.category[category],
              copy.shared.story.medals[assistance],
            )}
            : {copy.gameplay.elo(preview.payload.ratings[id])}
          </NativeText>
        ))}
        <NativeText>
          {copy.shared.story.standard}:{" "}
          {copy.gameplay.storyCompletion(completion.standard)}
        </NativeText>
        <NativeText>
          {copy.shared.story.chess960}:{" "}
          {copy.gameplay.storyCompletion(completion.chess960)}
        </NativeText>
      </NativePanel>
    )
  }
  if (!recovery && !snapshot.matches("loadFailure") && failed === null)
    return null
  const importIssue = selectImportIssue(snapshot)
  return (
    <NativePanel
      title={
        recovery
          ? messages.yourSaveNeedsAttention
          : failed === null
            ? copy.interface.webMapachessApplication
                .mapachessCouldNotReadLocalData
            : copy.interface.localSaveError.localSaveError
      }
      onBack={() => setConfirmReset(false)}
      actions={
        confirmReset ? (
          <View className="flex-row gap-2">
            <NativeButton
              variant="secondary"
              className="flex-1"
              onPress={() => setConfirmReset(false)}
            >
              {copy.setup.cancel}
            </NativeButton>
            <NativeButton
              variant="destructive"
              className="flex-1"
              onPress={() => {
                setConfirmReset(false)
                actor.send({ type: "PROFILE.RECOVERY_RESET_CONFIRMED" })
              }}
            >
              {messages.resetAllLocalPlayerData2}
            </NativeButton>
          </View>
        ) : (
          <>
            <NativeButton
              onPress={() =>
                actor.send({
                  type:
                    failed === null
                      ? "PROFILE.BOOT_RETRY_REQUESTED"
                      : "PROFILE.PERSISTENCE_RETRY_REQUESTED",
                })
              }
            >
              {copy.interface.webMapachessApplication.tryAgain}
            </NativeButton>
            {selectCurrentPlayerData(snapshot) === null ? null : (
              <NativeButton
                variant="secondary"
                disabled={files.status === "busy"}
                onPress={() => {
                  void files.exportData()
                }}
              >
                {copy.interface.profileSettingsPanel.exportPlayerData}
              </NativeButton>
            )}
            {recovery ? (
              <>
                <NativeButton
                  variant="secondary"
                  disabled={files.status === "busy"}
                  onPress={() => {
                    void files.exportUnreadable()
                  }}
                >
                  {messages.exportUnreadableData}
                </NativeButton>
                {selectHasLastKnownGoodSave(snapshot) ? (
                  <NativeButton
                    variant="secondary"
                    onPress={() =>
                      actor.send({
                        type: "PROFILE.RECOVERY_LAST_KNOWN_GOOD_REQUESTED",
                      })
                    }
                  >
                    {messages.restoreLastKnownGoodSave}
                  </NativeButton>
                ) : null}
                <NativeButton
                  variant="destructive"
                  onPress={() => setConfirmReset(true)}
                >
                  {messages.reviewFullLocalReset}
                </NativeButton>
              </>
            ) : null}
          </>
        )
      }
    >
      <NativeText>
        {confirmReset
          ? messages.thisReplacesAllLocalPlayerDataIncluding
          : recovery
            ? messages.mapachessCouldNotSafelyReadTheCurrent
            : copy.interface.matchRecovery.yourPendingChangeIsRetainedButNot}
      </NativeText>
      {importIssue === null ? null : (
        <NativeText accessibilityRole="alert">
          {importIssueMessage(importIssue, copy.profile)}
        </NativeText>
      )}
      {files.status === "failed" ? (
        <NativeText accessibilityRole="alert">
          {copy.profile.shareFailed}
        </NativeText>
      ) : null}
      {failed === null ? null : (
        <NativeText accessibilityRole="alert">
          {persistenceFailureMessage(failed, copy.profile)}
        </NativeText>
      )}
    </NativePanel>
  )
}
