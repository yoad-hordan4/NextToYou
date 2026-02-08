import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
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
        Alert.alert("Registration Failed", data.detail);
      }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* LOGO AREA */}
        <Image 
          source={require('@/assets/images/icon.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join NextToYou</Text>

        {/* FORM INPUTS */}
        <View style={styles.inputContainer}>
          
          <Text style={styles.label}>Username</Text>
          <TextInput 
            placeholder="Choose a username" 
            placeholderTextColor="#999"
            style={styles.input} 
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput 
            placeholder="Choose a password" 
            placeholderTextColor="#999"
            style={styles.input} 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
          />

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Battery Saver Settings</Text>
          <Text style={styles.helperText}>Only search for deals during these hours:</Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Start (0-24)</Text>
              <TextInput 
                style={styles.input} 
                value={startHour} 
                onChangeText={setStartHour} 
                keyboardType="numeric" 
                placeholder="8" 
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>End (0-24)</Text>
              <TextInput 
                style={styles.input} 
                value={endHour} 
                onChangeText={setEndHour} 
                keyboardType="numeric" 
                placeholder="22" 
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <Text style={styles.label}>Detection Radius (Meters)</Text>
          <TextInput 
            style={styles.input} 
            value={radius} 
            onChangeText={setRadius} 
            keyboardType="numeric" 
            placeholder="50" 
            placeholderTextColor="#999"
          />

        </View>

        {/* BUTTONS */}
        <TouchableOpacity style={styles.registerButton} onPress={onRegister}>
          <Text style={styles.registerButtonText}>Sign Up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Already have an account? <Text style={{fontWeight: 'bold'}}>Log In</Text></Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  scrollContainer: {
    padding: 30,
    justifyContent: 'center',
    minHeight: '100%'
  },
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 16 // Adds slight curve to app icon
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#333', 
    textAlign: 'center',
    marginBottom: 5 
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    marginTop: 10
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15
  },
  inputContainer: {
    gap: 15,
    marginBottom: 30
  },
  label: {
    fontWeight: '600',
    color: '#333',
    marginLeft: 5,
    marginBottom: 5
  },
  input: { 
    backgroundColor: '#F5F5F5', 
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: '#000'
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    gap: 15
  },
  halfInput: { 
    flex: 1 
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 10
  },
  registerButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 20
  },
  backButtonText: {
    color: '#666',
    fontSize: 16
  }
});