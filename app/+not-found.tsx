import React from 'react'
import { Link } from 'expo-router'
import { AppPage } from '@/components/ui/app-page'
import { AppText } from '@/components/ui/app-text'

export default function NotFoundScreen() {
  return (
    <AppPage>
      <AppText type="title">This screen does not exist.</AppText>
      <Link href="/">
        <AppText type="link">Go to home screen!</AppText>
      </Link>
    </AppPage>
  )
}