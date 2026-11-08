import cx from "classix"
import { Children, useRef, type ReactNode } from "react"
import { Pressable, type PressableProps, type View } from "react-native"
import type { PlayerInputAction } from "@mapachess/match/player-input"
import NativeInputPrompt from "../input/NativeInputPrompt"
import { useNativeInputControl } from "../input/NativeInputProvider"
import NativeText from "./NativeText"

export type NativeButtonProps = Omit<PressableProps, "onPress"> &
  Readonly<{
    onPress?: () => void
    action?: PlayerInputAction
    children: ReactNode
    variant?: "primary" | "secondary" | "hint" | "destructive"
    textClassName?: string
  }>

export default function NativeButton({
  children,
  className,
  textClassName,
  variant = "primary",
  action,
  ...props
}: NativeButtonProps) {
  const ref = useRef<View>(null)
  const focused = useNativeInputControl(
    ref,
    () => props.onPress?.(),
    !props.disabled,
  )
  const nodes = Children.toArray(children)
  const text = nodes.every(
    (node) => typeof node === "string" || typeof node === "number",
  )
    ? nodes.join("")
    : null
  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityRole={props.accessibilityRole ?? "button"}
      accessibilityState={{
        disabled: Boolean(props.disabled),
        ...props.accessibilityState,
      }}
      className={cx(
        "border-mapachito-charcoal shadow-mapachess-button shadow-mapachito-charcoal active:shadow-mapachess-pressed min-h-12 min-w-12 items-center justify-center rounded-tl-xl rounded-tr-sm rounded-br-xl rounded-bl-sm border-3 px-3 py-3 active:opacity-75 disabled:opacity-45",
        variant === "primary" && "bg-mapachito-raspberry",
        variant === "secondary" && "bg-mapachito-violet",
        variant === "hint" && "bg-mapachito-white shadow-mapachito-green",
        variant === "destructive" &&
          "border-mapachito-red bg-mapachito-charcoal shadow-mapachito-red",
        className,
        focused && "outline-mapachito-orange outline-3 outline-offset-2",
      )}
    >
      {text !== null ? (
        <NativeText
          className={cx(
            "font-native text-center",
            variant === "hint" && "text-mapachito-charcoal",
            textClassName,
          )}
        >
          {text}
        </NativeText>
      ) : (
        nodes.map((node, index) =>
          typeof node === "string" || typeof node === "number" ? (
            <NativeText
              key={index}
              className={cx(
                "font-native text-center",
                variant === "hint" && "text-mapachito-charcoal",
                textClassName,
              )}
            >
              {node}
            </NativeText>
          ) : (
            node
          ),
        )
      )}
      {action !== undefined || focused ? (
        <NativeInputPrompt
          action={action ?? "confirm"}
          textClassName={
            variant === "hint" ? "text-mapachito-charcoal" : undefined
          }
        />
      ) : null}
    </Pressable>
  )
}
