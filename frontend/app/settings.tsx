import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function SettingsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [radius, setRadius] = useState('');
  
  // Time State
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const session = await AsyncStorage.getItem('user_session');
    if (!session) return;
    const user = JSON.parse(session);
    setCurrentUser(user);
    
    setNewUsername(user.username);
    setRadius(user.notification_radius?.toString() || '50');
    
    // Convert saved integer hours back to Date objects
    const sTime = new Date(); sTime.setHours(user.active_start_hour || 8, 0, 0, 0);
    const eTime = new Date(); eTime.setHours(user.active_end_hour || 22, 0, 0, 0);
    setStartTime(sTime);
    setEndTime(eTime);
  };

  const handleUpdate = async () => {
    if (!currentUser) return;

    try {
      const body = {
        current_username: currentUser.username,
        current_password: currentUser.password,
        new_username: newUsername,
        new_password: newPassword || undefined,
        notification_radius: parseInt(radius),
        active_start_hour: startTime.getHours(), // Extract Hour
        active_end_hour: endTime.getHours()      // Extract Hour
      };

      const response = await fetch(`${API_BASE}/update-account`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('user_session', JSON.stringify(data.user));
        Alert.alert("Success", "Settings updated!", [
            { text: "OK", onPress: () => router.back() }
        ]);
      } else {
        Alert.alert("Error", data.detail || "Update failed");
      }
    } catch (error) {
      Alert.alert("Error", "Network error");
    }
  };

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
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
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>

      <Text style={styles.sectionTitle}>Account</Text>
      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={newUsername} onChangeText={setNewUsername} />
      
      <Text style={styles.label}>New Password (leave blank to keep)</Text>
      <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="********" secureTextEntry />

      <Text style={styles.sectionTitle}>Preferences</Text>
      <Text style={styles.label}>Notification Radius (meters)</Text>
      <TextInput style={styles.input} value={radius} onChangeText={setRadius} keyboardType="numeric" />

      <View style={styles.row}>
          <View style={{flex: 1, marginRight: 5}}>
            <Text style={styles.label}>Start Active</Text>
            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.timeButton}>
                <Text style={styles.timeText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
            {showStartPicker && (
                <DateTimePicker value={startTime} mode="time" display="spinner" onChange={onStartChange} is24Hour={true} />
            )}
          </View>

          <View style={{flex: 1, marginLeft: 5}}>
            <Text style={styles.label}>End Active</Text>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.timeButton}>
                <Text style={styles.timeText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
            {showEndPicker && (
                <DateTimePicker value={endTime} mode="time" display="spinner" onChange={onEndChange} is24Hour={true} />
            )}
          </View>
      </View>

      <View style={{height: 20}} />
      <Button title="Save Changes" onPress={handleUpdate} />
      
      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20, marginBottom: 40}}>
          <Text style={{color: 'blue', textAlign: 'center'}}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 30, fontWeight: 'bold', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 15, marginBottom: 10, color: '#333' },
  label: { fontSize: 12, color: '#666', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  timeButton: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center', backgroundColor: '#f9f9f9' },
  timeText: { fontSize: 16, fontWeight: 'bold' }
});