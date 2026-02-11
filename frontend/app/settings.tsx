import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function SettingsScreen() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [radius, setRadius] = useState('');
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const session = await AsyncStorage.getItem('user_session');
    if (!session) return;
    const user = JSON.parse(session);
    setCurrentUser(user);
    
    // Pre-fill fields
    setNewUsername(user.username);
    setRadius(user.notification_radius?.toString() || '50');
    setStartHour(user.active_start_hour?.toString() || '8');
    setEndHour(user.active_end_hour?.toString() || '22');
  };

  const handleUpdate = async () => {
    if (!currentUser) return;

    try {
      const body = {
        current_username: currentUser.username,
        current_password: currentUser.password, // Send current password to verify
        new_username: newUsername,
        new_password: newPassword || undefined, // Only send if changed
        notification_radius: parseInt(radius),
        active_start_hour: parseInt(startHour),
        active_end_hour: parseInt(endHour)
      };

      const response = await fetch(`${API_BASE}/update-account`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        // Update Local Storage with new data
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
            <Text style={styles.label}>Start Hour (0-23)</Text>
            <TextInput style={styles.input} value={startHour} onChangeText={setStartHour} keyboardType="numeric"/>
          </View>
          <View style={{flex: 1, marginLeft: 5}}>
            <Text style={styles.label}>End Hour (0-23)</Text>
            <TextInput style={styles.input} value={endHour} onChangeText={setEndHour} keyboardType="numeric"/>
          </View>
      </View>

      <Button title="Save Changes" onPress={handleUpdate} />
      
      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
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
  row: { flexDirection: 'row', justifyContent: 'space-between' }
});