import React from 'react'
import { ActivityIndicator } from 'react-native'
import { AppText } from '@/components/ui/app-text'
import { lamportsToSol } from '@/utils/lamports-to-sol'
import type { Address } from '@solana/kit'

interface Props {
  balance: bigint | undefined
  isLoading: boolean
}

export function AccountUiBalance({ balance, isLoading }: Props) {
  if (isLoading) {
    return <ActivityIndicator testID="balance-loading" />
  }
  if (balance === undefined) {
    return <AppText>-- SOL</AppText>
  }
  return (
    <AppText type="title" testID="balance-value">
      {lamportsToSol(balance).toFixed(5)} SOL
    </AppText>
  )
}