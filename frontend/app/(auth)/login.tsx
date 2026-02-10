import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
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
        await AsyncStorage.setItem('user_session', JSON.stringify(data.user));
        router.replace('/'); 
      } else {
        Alert.alert("Login Failed", data.detail);
      }
    } catch (e) { Alert.alert("Error", "Could not connect to server"); }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* LOGO AREA - UPDATED */}
        <Image 
          source={require('@/assets/images/nextomeLogo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        
        <Text style={styles.title}>NextToYou</Text>
        <Text style={styles.subtitle}>Smart Shopping Companion</Text>

        {/* INPUTS */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput 
            placeholder="Enter username" 
            placeholderTextColor="#999"
            style={styles.input} 
            value={username} 
            onChangeText={setUsername} 
            autoCapitalize="none"
          />
          
          <Text style={styles.label}>Password</Text>
          <TextInput 
            placeholder="Enter password" 
            placeholderTextColor="#999"
            style={styles.input} 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
          />
        </View>

        {/* BUTTONS */}
        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/register')} style={styles.createAccountButton}>
          <Text style={styles.createAccountText}>New here? <Text style={{fontWeight: 'bold'}}>Create Account</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  logo: {
    width: 100, // Slightly bigger
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
    borderRadius: 20 // Nice rounded corners for app icon
  },
  title: { 
    fontSize: 36, 
    fontWeight: '800', 
    color: '#333', 
    textAlign: 'center',
    marginBottom: 5 
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40
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
  loginButton: {
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
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
  },
  createAccountButton: {
    marginTop: 20,
    alignItems: 'center'
  },
  createAccountText: {
    color: '#666',
    fontSize: 16
  }
});