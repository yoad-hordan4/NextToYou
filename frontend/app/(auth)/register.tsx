import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [radius, setRadius] = useState('50'); 
  
  // Time State (Using Date objects for the picker)
  const [startTime, setStartTime] = useState(new Date(new Date().setHours(8, 0, 0, 0))); // Default 08:00
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(22, 0, 0, 0)));   // Default 22:00
  
  // Picker Visibility
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

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
            notification_radius: parseInt(radius) || 50,
            active_start_hour: startTime.getHours(),
            active_end_hour: endTime.getHours()
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

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (selectedDate) setStartTime(selectedDate);
    if (Platform.OS === 'android') setShowStartPicker(false);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndTime(selectedDate);
    if (Platform.OS === 'android') setShowEndPicker(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
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

      <Text style={styles.label}>Notify me within (meters):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="50" 
        value={radius} 
        onChangeText={setRadius} 
        keyboardType="numeric"
      />

      <View style={styles.row}>
          {/* Start Time Picker */}
          <View style={{flex: 1, marginRight: 5}}>
            <Text style={styles.label}>Start Active</Text>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.timeButton}>
                <Text style={styles.timeText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            
            {showStartPicker && (
                <DateTimePicker
                    value={startTime}
                    mode="time"
                    display="spinner" // 'spinner' is the classic wheel
                    onChange={onStartChange}
                    is24Hour={true}
                />
            )}
          </View>

          {/* End Time Picker */}
          <View style={{flex: 1, marginLeft: 5}}>
            <Text style={styles.label}>End Active</Text>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.timeButton}>
                <Text style={styles.timeText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>

            {showEndPicker && (
                <DateTimePicker
                    value={endTime}
                    mode="time"
                    display="spinner"
                    onChange={onEndChange}
                    is24Hour={true}
                />
            )}
          </View>
      </View>
      
      {/* iOS requires a button to close the spinner if it's inline, 
          but usually standard behavior is tapping away. 
          To keep it clean, we just show the Register button below. */}

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
  link: { color: 'blue', textAlign: 'center' },
  timeButton: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center', backgroundColor: '#f9f9f9' },
  timeText: { fontSize: 16, fontWeight: 'bold' }
});