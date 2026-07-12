import React from 'react'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useThemeColor } from '@/hooks/use-theme-color'

const nameMap: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  'gearshape.fill': 'settings',
  'wallet.pass.fill': 'wallet',
  'ladybug.fill': 'bug-report',
}

interface Props {
  name: string
  size?: number
  color?: string
}

export function UiIconSymbol({ name, size = 24, color }: Props) {
  const defaultColor = useThemeColor({}, 'icon')
  const iconName = nameMap[name]
  return (
    <MaterialIcons
      name={iconName ?? 'help-outline'}
      size={size}
      color={color ?? defaultColor}
    />
  )
}
