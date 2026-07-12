import React from 'react'
import { BaseButton } from '@/components/solana/base-button'

interface Props {
  label?: string
  onPress?: () => void
}

export function WalletUiButtonConnect({ label = 'Connect', onPress }: Props) {
  return <BaseButton label={label} onPress={onPress ?? (() => {})} />
}