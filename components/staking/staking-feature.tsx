import React from 'react'
import { StyleSheet } from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'

export function StakingFeature() {
  return (
    <AppView style={styles.card}>
      <AppText type="subtitle">Staking</AppText>
      <AppText>Staking coming soon. Stake SOL to secure the network and earn rewards.</AppText>
    </AppView>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
  },
})