import { Tabs } from 'expo-router'
import React from 'react'

/**
 * Buyer tab group — Phase 1
 * Screens (Home, Cart, Wishlist, Profile, Checkout) stay registered.
 * Visual bottom tab bar is removed; navigation will move to the drawer later.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="cart" options={{ title: 'Cart' }} />
      <Tabs.Screen name="favorites" options={{ title: 'Wishlist' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen
        name="checkout"
        options={{
          title: 'Checkout',
          href: null,
        }}
      />
    </Tabs>
  )
}