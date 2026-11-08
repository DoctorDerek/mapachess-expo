import { useState, type ReactNode } from "react"
import { View } from "react-native"
import { useNativeLocale } from "../profile/NativeLocaleProvider"
import NativeButton from "./NativeButton"
import NativePanel from "./NativePanel"
import NativeText from "./NativeText"

export type NativeChoice<Value extends string | number> = Readonly<{
  value: Value
  label: string
  description?: string
  disabled?: boolean
  preview?: ReactNode
}>

export default function NativeChoicePanel<Value extends string | number>({
  title,
  value,
  choices,
  onCancel,
  onAccept,
}: Readonly<{
  title: string
  value: Value
  choices: readonly NativeChoice<Value>[]
  onCancel: () => void
  onAccept: (value: Value) => void
}>) {
  const [selection, setSelection] = useState(value)
  const { copy } = useNativeLocale()
  return (
    <NativePanel
      title={title}
      onBack={onCancel}
      actions={
        <View className="flex-row gap-2">
          <NativeButton
            variant="secondary"
            className="flex-1"
            onPress={onCancel}
          >
            {copy.setup.cancel}
          </NativeButton>
          <NativeButton className="flex-1" onPress={() => onAccept(selection)}>
            {copy.setup.done}
          </NativeButton>
        </View>
      }
    >
      {choices.map((choice) => (
        <NativeButton
          key={choice.value}
          disabled={choice.disabled}
          variant={choice.value === selection ? "primary" : "secondary"}
          accessibilityLabel={choice.label}
          accessibilityState={{ selected: choice.value === selection }}
          onPress={() => setSelection(choice.value)}
        >
          <View className="w-full flex-row items-center gap-3">
            {choice.preview === undefined ? null : (
              <View className="size-16 shrink-0">{choice.preview}</View>
            )}
            <View className="min-w-0 flex-1">
              <NativeText className="font-native">{choice.label}</NativeText>
              {choice.description === undefined ? null : (
                <NativeText className="text-sm">
                  {choice.description}
                </NativeText>
              )}
            </View>
          </View>
        </NativeButton>
      ))}
    </NativePanel>
  )
}
