import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

export default function SettingsScreen() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Home location
  const [homeAddress, setHomeAddress] = useState('');
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLon, setHomeLon] = useState<number | null>(null);
  
  // Work location
  const [workAddress, setWorkAddress] = useState('');
  const [workLat, setWorkLat] = useState<number | null>(null);
  const [workLon, setWorkLon] = useState<number | null>(null);
  
  // Other settings
  const [startHour, setStartHour] = useState('8');
  const [endHour, setEndHour] = useState('22');
  const [radius, setRadius] = useState('500');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const session = await AsyncStorage.getItem('user_session');
      if (!session) {
        router.replace('/login');
        return;
      }
      
      const userData = JSON.parse(session);
      setUser(userData);
      
      // Fetch latest settings from server
      const response = await fetch(`${API_BASE}/user/${userData.username}/settings`, {
        headers: API_HEADERS
      });
      
      if (response.ok) {
        const settings = await response.json();
        
        // Load home location
        if (settings.home_address) setHomeAddress(settings.home_address);
        if (settings.home_latitude) setHomeLat(settings.home_latitude);
        if (settings.home_longitude) setHomeLon(settings.home_longitude);
        
        // Load work location
        if (settings.work_address) setWorkAddress(settings.work_address);
        if (settings.work_latitude) setWorkLat(settings.work_latitude);
        if (settings.work_longitude) setWorkLon(settings.work_longitude);
        
        // Load other settings
        setStartHour(settings.active_start_hour?.toString() || '8');
        setEndHour(settings.active_end_hour?.toString() || '22');
        setRadius(settings.notification_radius?.toString() || '500');
      }
      
      setLoading(false);
    } catch (e) {
      console.error('Error loading settings:', e);
      setLoading(false);
    }
  };

  const setCurrentLocationAsHome = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable location access');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setHomeLat(location.coords.latitude);
      setHomeLon(location.coords.longitude);
      
      // Try to get address from coordinates
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (addresses.length > 0) {
        const addr = addresses[0];
        const addressStr = `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
        setHomeAddress(addressStr);
      }
      
      Alert.alert('Success', 'Home location set to current location');
    } catch (e) {
      Alert.alert('Error', 'Failed to get location');
      console.error(e);
    }
  };

  const setCurrentLocationAsWork = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable location access');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setWorkLat(location.coords.latitude);
      setWorkLon(location.coords.longitude);
      
      // Try to get address from coordinates
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (addresses.length > 0) {
        const addr = addresses[0];
        const addressStr = `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
        setWorkAddress(addressStr);
      }
      
      Alert.alert('Success', 'Work location set to current location');
    } catch (e) {
      Alert.alert('Error', 'Failed to get location');
      console.error(e);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    
    try {
      const settingsUpdate = {
        home_address: homeAddress || null,
        home_latitude: homeLat,
        home_longitude: homeLon,
        work_address: workAddress || null,
        work_latitude: workLat,
        work_longitude: workLon,
        active_start_hour: parseInt(startHour),
        active_end_hour: parseInt(endHour),
        notification_radius: parseInt(radius)
      };
      
      const response = await fetch(`${API_BASE}/user/${user.username}/settings`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify(settingsUpdate)
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        
        // Update local session
        await AsyncStorage.setItem('user_session', JSON.stringify(updatedUser.user));
        
        Alert.alert('Success', 'Settings saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save settings');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Home Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏠 Home Location</Text>
        <Text style={styles.subtitle}>Used for &quot;remind me when leaving home&quot; tasks</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Home address (optional)"
          value={homeAddress}
          onChangeText={setHomeAddress}
          multiline
        />
        
        {homeLat && homeLon && (
          <Text style={styles.coordText}>
            📍 {homeLat.toFixed(6)}, {homeLon.toFixed(6)}
          </Text>
        )}
        
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={setCurrentLocationAsHome}
        >
          <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
        </TouchableOpacity>
      </View>

      {/* Work Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💼 Work Location</Text>
        <Text style={styles.subtitle}>Used for &quot;remind me when leaving work&quot; tasks</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Work address (optional)"
          value={workAddress}
          onChangeText={setWorkAddress}
          multiline
        />
        
        {workLat && workLon && (
          <Text style={styles.coordText}>
            📍 {workLat.toFixed(6)}, {workLon.toFixed(6)}
          </Text>
        )}
        
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={setCurrentLocationAsWork}
        >
          <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
        </TouchableOpacity>
      </View>

      {/* Active Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏰ Active Hours</Text>
        <Text style={styles.subtitle}>Only track location during these hours to save battery</Text>
        
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Start Hour (0-23)</Text>
            <TextInput
              style={styles.input}
              value={startHour}
              onChangeText={setStartHour}
              keyboardType="numeric"
              placeholder="8"
            />
          </View>
          
          <View style={styles.halfInput}>
            <Text style={styles.label}>End Hour (0-23)</Text>
            <TextInput
              style={styles.input}
              value={endHour}
              onChangeText={setEndHour}
              keyboardType="numeric"
              placeholder="22"
            />
          </View>
        </View>
      </View>

      {/* Notification Radius */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📍 Detection Radius</Text>
        <Text style={styles.subtitle}>How close you need to be to get notified (meters)</Text>
        
        <TextInput
          style={styles.input}
          value={radius}
          onChangeText={setRadius}
          keyboardType="numeric"
          placeholder="500"
        />
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveSettings}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#333',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    fontSize: 16,
  },
  coordText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  locationButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  locationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 15,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  spacer: {
    height: 40,
  },
});