import React, { useMemo } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useGetValidators } from '@/features/staking/use-get-validators'

export function StakingFeature() {
  const { data: validators, isLoading, isError } = useGetValidators()

  const filteredSortedValidators = useMemo(() => {
    if (!validators) return []
    return validators
      .filter((v) => v.commission !== 100)
      .sort((a, b) => {
        if (a.commission !== b.commission) {
          return a.commission - b.commission
        }
        return Number(b.activatedStake - a.activatedStake)
      })
  }, [validators])

  if (isLoading) {
    return (
      <AppView style={styles.card}>
        <AppText type="subtitle">Staking</AppText>
        <AppText>Loading validators...</AppText>
      </AppView>
    )
  }

  if (isError) {
    return (
      <AppView style={styles.card}>
        <AppText type="subtitle">Staking</AppText>
        <AppText>Failed to load validators.</AppText>
      </AppView>
    )
  }

  return (
    <AppView style={styles.card}>
      <AppText type="subtitle">Staking</AppText>
      <FlatList
        testID="validator-list"
        data={filteredSortedValidators}
        keyExtractor={(item) => item.votePubkey}
        renderItem={({ item }) => (
          <AppView style={styles.validatorItem}>
            <AppText>Vote Key: {item.votePubkey}</AppText>
            <AppText>Commission: {item.commission}%</AppText>
          </AppView>
        )}
      />
    </AppView>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
  },
  validatorItem: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
  },
})