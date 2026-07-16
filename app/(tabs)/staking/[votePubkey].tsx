import React, { useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppPage } from '@/components/ui/app-page'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'

export default function StakingVotePubkeyScreen() {
  const { votePubkey } = useLocalSearchParams<{ votePubkey: string }>()
  const [amount, setAmount] = useState('')

  return (
    <AppPage>
      <AppView style={styles.container}>
        <AppText type="title" style={styles.title}>
          Stake with Validator
        </AppText>

        <AppView style={styles.pubkeyCard}>
          <AppText type="defaultSemiBold">Validator</AppText>
          <AppText style={styles.pubkeyText} selectable>
            {votePubkey ?? 'Unknown'}
          </AppText>
        </AppView>

        <AppView style={styles.inputCard}>
          <AppText type="defaultSemiBold">Amount (SOL)</AppText>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </AppView>

        <AppView style={styles.buttonCard}>
          <AppView style={styles.stakeButton}>
            <AppText type="defaultSemiBold" style={styles.stakeButtonText}>
              Stake SOL
            </AppText>
          </AppView>
        </AppView>
      </AppView>
    </AppPage>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  title: {
    marginBottom: 24,
  },
  pubkeyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  pubkeyText: {
    marginTop: 8,
    fontSize: 14,
  },
  inputCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  input: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '600',
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  buttonCard: {
    marginTop: 16,
  },
  stakeButton: {
    backgroundColor: '#9945FF',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  stakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
})