import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Custom Settings
  const [startHour, setStartHour] = useState('8');
  const [endHour, setEndHour] = useState('22');
  const [radius, setRadius] = useState('50');

  const onRegister = async () => {
    try {
      const newUser = {
        username,
        password,
        active_start_hour: parseInt(startHour),
        active_end_hour: parseInt(endHour),
        notification_radius: parseInt(radius)
      };

      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(newUser)
      });

      if (res.ok) {
        Alert.alert("Success", "Account created! Please login.");
        router.back();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.detail);
      }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      <Text style={styles.label}>Credentials</Text>
      <TextInput placeholder="Username" style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none"/>
      <TextInput placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.label}>Active Hours (0-24)</Text>
      <Text style={styles.sub}>Save battery by only searching during these hours.</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.half]} value={startHour} onChangeText={setStartHour} keyboardType="numeric" placeholder="Start (8)" />
        <TextInput style={[styles.input, styles.half]} value={endHour} onChangeText={setEndHour} keyboardType="numeric" placeholder="End (22)" />
      </View>

      <Text style={styles.label}>Detection Radius (Meters)</Text>
      <TextInput style={styles.input} value={radius} onChangeText={setRadius} keyboardType="numeric" placeholder="50" />

      <Button title="Register" onPress={onRegister} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 5 },
  sub: { fontSize: 12, color: '#666', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 15, borderRadius: 10, marginBottom: 5, backgroundColor: 'white' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48%' }
});