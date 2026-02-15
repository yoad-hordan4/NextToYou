import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../constants/apiKeys';

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
  
  // Time settings
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Other settings
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
      
      const response = await fetch(`${API_BASE}/user/${userData.username}/settings`, {
        headers: API_HEADERS
      });
      
      if (response.ok) {
        const settings = await response.json();
        
        // Load locations
        if (settings.home_address) setHomeAddress(settings.home_address);
        if (settings.home_latitude) setHomeLat(settings.home_latitude);
        if (settings.home_longitude) setHomeLon(settings.home_longitude);
        
        if (settings.work_address) setWorkAddress(settings.work_address);
        if (settings.work_latitude) setWorkLat(settings.work_latitude);
        if (settings.work_longitude) setWorkLon(settings.work_longitude);
        
        // Load times (HH:MM format)
        if (settings.active_start_time) {
          const [h, m] = settings.active_start_time.split(':');
          const date = new Date();
          date.setHours(parseInt(h), parseInt(m));
          setStartTime(date);
        }
        
        if (settings.active_end_time) {
          const [h, m] = settings.active_end_time.split(':');
          const date = new Date();
          date.setHours(parseInt(h), parseInt(m));
          setEndTime(date);
        }
        
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

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
        active_start_time: formatTime(startTime),
        active_end_time: formatTime(endTime),
        notification_radius: parseInt(radius)
      };
      
      const response = await fetch(`${API_BASE}/user/${user.username}/settings`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify(settingsUpdate)
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        await AsyncStorage.setItem('user_session', JSON.stringify(updatedUser.user));
        Alert.alert('Success', 'Settings saved!');
        router.back(); // Navigate back to main screen
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
        <Text style={styles.subtitle}>Used for &quot;remind me when leaving home&quot;</Text>
        
        {homeLat && homeLon ? (
          <View style={styles.locationSet}>
            <Text style={styles.addressText}>{homeAddress || 'Location set'}</Text>
            <Text style={styles.coordText}>
              📍 {homeLat.toFixed(6)}, {homeLon.toFixed(6)}
            </Text>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setHomeAddress('');
                setHomeLat(null);
                setHomeLon(null);
              }}
            >
              <Text style={styles.clearButtonText}>Clear Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationEmpty}>
            <GooglePlacesAutocomplete
              placeholder='Search for home address...'
              onPress={(data, details = null) => {
                if (details) {
                  setHomeLat(details.geometry.location.lat);
                  setHomeLon(details.geometry.location.lng);
                  setHomeAddress(data.description);
                }
              }}
              query={{
                key: GOOGLE_PLACES_API_KEY,
                language: 'en',
              }}
              fetchDetails={true}
              styles={{
                textInput: styles.googlePlacesInput,
                container: { flex: 0 },
              }}
            />
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={setCurrentLocationAsHome}
            >
              <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Work Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💼 Work Location</Text>
        <Text style={styles.subtitle}>Used for &quot;remind me when leaving work&quot;</Text>
        
        {workLat && workLon ? (
          <View style={styles.locationSet}>
            <Text style={styles.addressText}>{workAddress || 'Location set'}</Text>
            <Text style={styles.coordText}>
              📍 {workLat.toFixed(6)}, {workLon.toFixed(6)}
            </Text>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                setWorkAddress('');
                setWorkLat(null);
                setWorkLon(null);
              }}
            >
              <Text style={styles.clearButtonText}>Clear Location</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.locationEmpty}>
            <GooglePlacesAutocomplete
              placeholder='Search for work address...'
              onPress={(data, details = null) => {
                if (details) {
                  setWorkLat(details.geometry.location.lat);
                  setWorkLon(details.geometry.location.lng);
                  setWorkAddress(data.description);
                }
              }}
              query={{
                key: GOOGLE_PLACES_API_KEY,
                language: 'en',
              }}
              fetchDetails={true}
              styles={{
                textInput: styles.googlePlacesInput,
                container: { flex: 0 },
              }}
            />
            <TouchableOpacity 
              style={styles.locationButton}
              onPress={setCurrentLocationAsWork}
            >
              <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Active Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⏰ Active Hours</Text>
        <Text style={styles.subtitle}>Only track location during these hours to save battery</Text>
        
        <View style={styles.timeRow}>
          <View style={styles.timeInput}>
            <Text style={styles.label}>Start Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={styles.timeButtonText}>{formatTime(startTime)}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.timeInput}>
            <Text style={styles.label}>End Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => setShowEndPicker(true)}
            >
              <Text style={styles.timeButtonText}>{formatTime(endTime)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (selectedDate) setStartTime(selectedDate);
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (selectedDate) setEndTime(selectedDate);
            }}
          />
        )}
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
  locationSet: {
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  locationEmpty: {
    minHeight: 100,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  coordText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  googlePlacesInput: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    fontSize: 16,
    marginBottom: 10,
  },
  locationButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  locationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 15,
  },
  timeInput: {
    flex: 1,
  },
  timeButton: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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