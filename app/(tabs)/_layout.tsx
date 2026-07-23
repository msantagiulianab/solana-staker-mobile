import { Tabs } from 'expo-router'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'
import { useThemeColor } from '@/hooks/use-theme-color'
import React from 'react'

export default function TabLayout() {
  const tintColor = useThemeColor({}, 'tint')

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tintColor,
      }}
    >
      <Tabs.Screen
        name="account/index"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <UiIconSymbol name="wallet.pass.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <UiIconSymbol name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="staking/index"
        options={{
          title: 'Staking',
          tabBarIcon: ({ color }) => <UiIconSymbol name="chart.pie.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="demo/index"
        options={{
          title: 'Demo',
          tabBarIcon: ({ color }) => <UiIconSymbol name="ladybug.fill" color={color} />,
        }}
      />

      {/* Explicitly hide the dynamic route from showing up as a bottom button */}
      <Tabs.Screen
        name="staking/[votePubkey]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  )
}