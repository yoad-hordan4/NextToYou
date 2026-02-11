import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // New State for Radius
  const [radius, setRadius] = useState('50'); 
  const [startHour, setStartHour] = useState('8');
  const [endHour, setEndHour] = useState('22');

  const handleRegister = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ 
            username, 
            password,
            // Send the user's preferred radius
            notification_radius: parseInt(radius) || 50,
            active_start_hour: parseInt(startHour) || 8,
            active_end_hour: parseInt(endHour) || 22
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Account created! Please login.');
        router.replace('/login');
      } else {
        Alert.alert('Error', data.detail || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Is the backend running?');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="Username" 
        value={username} 
        onChangeText={setUsername} 
        autoCapitalize="none"
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Password" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
      />

      {/* --- NEW RADIUS INPUT --- */}
      <Text style={styles.label}>Notify me within (meters):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="50" 
        value={radius} 
        onChangeText={setRadius} 
        keyboardType="numeric"
      />

      <View style={styles.row}>
          <View style={{flex: 1, marginRight: 5}}>
            <Text style={styles.label}>Start Hour (0-23)</Text>
            <TextInput 
                style={styles.input} 
                value={startHour} 
                onChangeText={setStartHour} 
                keyboardType="numeric"
            />
          </View>
          <View style={{flex: 1, marginLeft: 5}}>
            <Text style={styles.label}>End Hour (0-23)</Text>
            <TextInput 
                style={styles.input} 
                value={endHour} 
                onChangeText={setEndHour} 
                keyboardType="numeric"
            />
          </View>
      </View>

      <Button title="Register" onPress={handleRegister} />

      <TouchableOpacity onPress={() => router.replace('/login')} style={{marginTop: 20}}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 12, color: '#666', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  link: { color: 'blue', textAlign: 'center' }
});