import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: '#E5E5EA',
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'My List',
          tabBarIcon: ({ color }) => <span style={{ fontSize: 24 }}>📝</span>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <span style={{ fontSize: 24 }}>⚙️</span>,
        }}
      />
      {/* Hide these screens from tabs */}
      <Tabs.Screen
        name="(auth)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(tabs)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="modal"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}