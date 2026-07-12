import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { AppPage } from '@/components/ui/app-page'
import { AppView } from '@/components/ui/app-view'
import { AppText } from '@/components/ui/app-text'
import { WalletUiButtonConnect } from '@/components/solana/wallet-ui-button-connect'
import { AppConfig } from '@/constants/app-config'
import { useMobileWallet } from '@wallet-ui/react-native-kit'

export default function SignInScreen() {
  const { connect } = useMobileWallet()

  return (
    <AppPage>
      <AppView style={styles.centered}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <AppText type="title">{AppConfig.identity.name}</AppText>
      </AppView>
      <AppView style={styles.bottom}>
        <WalletUiButtonConnect label="Connect" onPress={connect} />
      </AppView>
    </AppPage>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  bottom: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  icon: {
    width: 128,
    height: 128,
  },
})