import cx from "classix"
import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import {
  HOME_WORDMARK_CLASS_NAME,
  type HomeActionProps,
  type HomeElements,
  type HomeGroupProps,
  type HomeSettingsProps,
  type HomeTextProps,
} from "@mapachess/application-ui/home-elements"
import NativeButton from "@/components/presentation/NativeButton"
import NativeText from "@/components/presentation/NativeText"
import { nativeProfileCardElements } from "@/components/profile/NativeProfileCard"

function Surface({
  children,
  className,
}: Readonly<{ children: ReactNode; className: string }>) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cx(className, "p-4 pb-8 xl:p-6")}
    >
      {children}
    </ScrollView>
  )
}

function Group({ children, className }: HomeGroupProps) {
  return <View className={className}>{children}</View>
}

function Title({ label }: Readonly<{ label: string }>) {
  return (
    <NativeText
      accessibilityRole="header"
      className={cx(HOME_WORDMARK_CLASS_NAME, "max-w-full min-w-0 shrink")}
    >
      {label}
    </NativeText>
  )
}

function Text({ children, className, decorative = false }: HomeTextProps) {
  return (
    <NativeText
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      className={className}
    >
      {children}
    </NativeText>
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
  return (
    <NativeButton
      disabled={disabled}
      accessibilityLabel={label}
      onPress={onActivate}
      textClassName="font-home text-xl"
      className={cx(className, kind !== "resume" && "border-0")}
    >
      {children}
    </NativeButton>
  )
}

function Settings({
  children,
  disabled,
  expanded,
  onActivate,
}: HomeSettingsProps<null>) {
  return (
    <NativeButton
      variant="secondary"
      disabled={disabled}
      accessibilityState={{ expanded }}
      onPress={onActivate}
    >
      {children}
    </NativeButton>
  )
}

const nativeHomeElements: HomeElements<null> = {
  Surface,
  Group,
  Title,
  Text,
  Action,
  Settings,
  card: nativeProfileCardElements,
}

export default nativeHomeElements
