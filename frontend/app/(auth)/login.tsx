import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        // Save user session locally
        await AsyncStorage.setItem('user_session', JSON.stringify(data.user));
        router.replace('/(tabs)'); // Go to App
      } else {
        Alert.alert("Error", data.detail);
      }
    } catch (e) { Alert.alert("Error", "Server not reachable"); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>NextToYou 👋</Text>
      <TextInput placeholder="Username" style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none"/>
      <TextInput placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Login" onPress={onLogin} />
      <Button title="Create Account" onPress={() => router.push('/register')} color="gray" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 30, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 15, borderRadius: 10, marginBottom: 10, backgroundColor: 'white' }
});