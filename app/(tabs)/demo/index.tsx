import React, { useState } from 'react'
import { TextInput, StyleSheet, TouchableOpacity } from 'react-native'
import { AppPage } from '@/components/ui/app-page'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useMutation } from '@tanstack/react-query'
import { useThemeColor } from '@/hooks/use-theme-color'

export default function DemoPage() {
  const { signMessages } = useMobileWallet()
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const borderColor = useThemeColor({}, 'border')
  const textColor = useThemeColor({}, 'text')

  const signMutation = useMutation({
    mutationKey: ['sign-message'],
    mutationFn: async (msg: string) => {
      const encoder = new TextEncoder()
      const messageBytes = encoder.encode(msg)
      const [signed] = await signMessages([messageBytes])
      return signed
    },
    onSuccess: () => setResult('Message signed successfully!'),
    onError: (err) => setResult(`Error: ${String(err)}`),
  })

  return (
    <AppPage>
      <AppText type="subtitle">Demo page</AppText>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Enter message to sign"
        placeholderTextColor={textColor}
        style={[styles.input, { borderColor, color: textColor }]}
        multiline
      />
      <TouchableOpacity
        onPress={() => signMutation.mutate(message)}
        style={[styles.button, { backgroundColor: borderColor }]}
      >
        <AppText>Sign Message</AppText>
      </TouchableOpacity>
      {signMutation.isPending && <AppText>Signing...</AppText>}
      {result && <AppText>{result}</AppText>}
    </AppPage>
  )
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
})