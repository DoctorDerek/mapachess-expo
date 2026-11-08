import cx from "classix"
import { Text, type TextProps } from "react-native"

export default function NativeText({ className, ...props }: TextProps) {
  return (
    <Text
      {...props}
      className={cx(
        "font-native-body text-mapachito-white text-base leading-normal",
        className,
      )}
    />
  )
}
