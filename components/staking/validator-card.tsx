import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { ellipsify } from '@/utils/ellipsify'

interface ValidatorCardProps {
  votePubkey: string
  commission: number
  onPress?: () => void
}

export function ValidatorCard({ votePubkey, commission, onPress }: ValidatorCardProps) {
  return (
    <TouchableOpacity testID="validator-card" onPress={onPress} activeOpacity={0.7} accessibilityRole="button" style={styles.card}>
      <AppText type="defaultSemiBold" style={styles.pubkey}>
        {ellipsify(votePubkey)}
      </AppText>
      <AppView style={styles.commissionRow}>
        <AppText style={styles.commissionLabel}>Commission:</AppText>
        <AppText type="defaultSemiBold" style={styles.commissionValue}>
          {commission}%
        </AppText>
      </AppView>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  pubkey: {
    fontSize: 15,
    marginBottom: 8,
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionLabel: {
    fontSize: 14,
  },
  commissionValue: {
    fontSize: 16,
  },
})