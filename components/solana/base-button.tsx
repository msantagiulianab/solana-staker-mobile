import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useWalletUiTheme } from '@/components/solana/use-wallet-ui-theme'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'

interface Props {
  label: string
  onPress: () => void
}

export function BaseButton({ label, onPress }: Props) {
  const { backgroundColor, borderColor, textColor } = useWalletUiTheme()

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, { backgroundColor, borderColor: borderColor }]}
    >
      <UiIconSymbol name="wallet.pass.fill" size={20} color={textColor} />
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
})