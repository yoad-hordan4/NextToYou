import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../constants/apiKeys';

interface ReminderConfig {
  type: 'none' | 'leaving_home' | 'leaving_work' | 'custom_location' | 'specific_time';
  custom_latitude?: number;
  custom_longitude?: number;
  custom_address?: string;
  leaving_radius?: number;
  time?: string;
  days?: string[];
}

interface TaskCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateTask: (title: string, category: string, reminder: ReminderConfig) => void;
  categories: string[];
}

export default function TaskCreationModal({ visible, onClose, onCreateTask, categories }: TaskCreationModalProps) {
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const [reminderType, setReminderType] = useState<ReminderConfig['type']>('none');
  
  // Custom location
  const [customAddress, setCustomAddress] = useState('');
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLon, setCustomLon] = useState<number | null>(null);
  const [leavingRadius, setLeavingRadius] = useState('200');
  
  // Time-based
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(['everyday']);
  
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const resetForm = () => {
    setTitle('');
    setSelectedCategory(categories[0]);
    setReminderType('none');
    setCustomAddress('');
    setCustomLat(null);
    setCustomLon(null);
    setLeavingRadius('200');
    setReminderTime(new Date());
    setSelectedDays(['everyday']);
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task name');
      return;
    }

    const reminder: ReminderConfig = { type: reminderType };

    if (reminderType === 'custom_location') {
      if (!customLat || !customLon) {
        Alert.alert('Error', 'Please set a location for the reminder');
        return;
      }
      reminder.custom_latitude = customLat;
      reminder.custom_longitude = customLon;
      reminder.custom_address = customAddress;
      reminder.leaving_radius = parseInt(leavingRadius);
    }

    if (reminderType === 'specific_time') {
      reminder.time = formatTime(reminderTime);
      reminder.days = selectedDays;
    }

    if (reminderType === 'leaving_home' || reminderType === 'leaving_work') {
      reminder.leaving_radius = parseInt(leavingRadius);
    }

    onCreateTask(title, selectedCategory, reminder);
    resetForm();
    onClose();
  };

  const setCustomLocationToCurrent = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable location access');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCustomLat(location.coords.latitude);
      setCustomLon(location.coords.longitude);
      
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (addresses.length > 0) {
        const addr = addresses[0];
        const addressStr = `${addr.street || ''}, ${addr.city || ''}`.trim();
        setCustomAddress(addressStr);
      }
      
      Alert.alert('Success', 'Location set to current location');
    } catch (e) {
      Alert.alert('Error', 'Failed to get location');
      console.error(e);
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes('everyday')) {
      setSelectedDays([day]);
    } else if (selectedDays.includes(day)) {
      const newDays = selectedDays.filter(d => d !== day);
      setSelectedDays(newDays.length > 0 ? newDays : ['everyday']);
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Task</Text>
          <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
            <Text style={styles.closeButton}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Task Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Task Name</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g., Buy milk"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Reminder Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Reminder</Text>
            
            <TouchableOpacity
              style={[styles.reminderOption, reminderType === 'none' && styles.reminderOptionActive]}
              onPress={() => setReminderType('none')}
            >
              <Text style={styles.reminderOptionText}>🔕 No reminder (search anytime)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reminderOption, reminderType === 'leaving_home' && styles.reminderOptionActive]}
              onPress={() => setReminderType('leaving_home')}
            >
              <Text style={styles.reminderOptionText}>🏠 When leaving home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reminderOption, reminderType === 'leaving_work' && styles.reminderOptionActive]}
              onPress={() => setReminderType('leaving_work')}
            >
              <Text style={styles.reminderOptionText}>💼 When leaving work</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reminderOption, reminderType === 'custom_location' && styles.reminderOptionActive]}
              onPress={() => setReminderType('custom_location')}
            >
              <Text style={styles.reminderOptionText}>📍 When leaving a custom location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reminderOption, reminderType === 'specific_time' && styles.reminderOptionActive]}
              onPress={() => setReminderType('specific_time')}
            >
              <Text style={styles.reminderOptionText}>⏰ At a specific time</Text>
            </TouchableOpacity>
          </View>

          {/* Custom Location Settings */}
          {reminderType === 'custom_location' && (
            <View style={styles.section}>
              <Text style={styles.label}>Custom Location</Text>
              
              {customLat && customLon ? (
                <View style={styles.locationSet}>
                  <Text style={styles.addressText}>{customAddress || 'Location set'}</Text>
                  <Text style={styles.coordText}>
                    📍 {customLat.toFixed(6)}, {customLon.toFixed(6)}
                  </Text>
                  <TouchableOpacity 
                    style={styles.clearButton}
                    onPress={() => {
                      setCustomAddress('');
                      setCustomLat(null);
                      setCustomLon(null);
                    }}
                  >
                    <Text style={styles.clearButtonText}>Clear Location</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <GooglePlacesAutocomplete
                    placeholder='Search for a location...'
                    onPress={(data, details = null) => {
                      if (details) {
                        setCustomLat(details.geometry.location.lat);
                        setCustomLon(details.geometry.location.lng);
                        setCustomAddress(data.description);
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
                    onPress={setCustomLocationToCurrent}
                  >
                    <Text style={styles.locationButtonText}>📍 Use Current Location</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={[styles.label, { marginTop: 15 }]}>Trigger Distance</Text>
              <Text style={styles.subtitle}>Remind me when Im this far from the location</Text>
              
              <View style={styles.radiusOptions}>
                {['100', '200', '300', '500'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusChip, leavingRadius === r && styles.radiusChipActive]}
                    onPress={() => setLeavingRadius(r)}
                  >
                    <Text style={[styles.radiusText, leavingRadius === r && styles.radiusTextActive]}>
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Leaving Home/Work Radius */}
          {(reminderType === 'leaving_home' || reminderType === 'leaving_work') && (
            <View style={styles.section}>
              <Text style={styles.label}>Trigger Distance</Text>
              <Text style={styles.subtitle}>
                Remind me when Im this far from {reminderType === 'leaving_home' ? 'home' : 'work'}
              </Text>
              
              <View style={styles.radiusOptions}>
                {['100', '200', '300', '500'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.radiusChip, leavingRadius === r && styles.radiusChipActive]}
                    onPress={() => setLeavingRadius(r)}
                  >
                    <Text style={[styles.radiusText, leavingRadius === r && styles.radiusTextActive]}>
                      {r}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Time-based Settings */}
          {reminderType === 'specific_time' && (
            <View style={styles.section}>
              <Text style={styles.label}>Time</Text>
              
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>{formatTime(reminderTime)}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (selectedDate) setReminderTime(selectedDate);
                  }}
                />
              )}
              
              <Text style={styles.label}>Days</Text>
              
              <TouchableOpacity
                style={[styles.dayChip, selectedDays.includes('everyday') && styles.dayChipActive]}
                onPress={() => setSelectedDays(['everyday'])}
              >
                <Text style={[styles.dayText, selectedDays.includes('everyday') && styles.dayTextActive]}>
                  Everyday
                </Text>
              </TouchableOpacity>
              
              <View style={styles.daysRow}>
                {DAYS.map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayChip,
                      selectedDays.includes(day) && styles.dayChipActive,
                      selectedDays.includes('everyday') && styles.dayChipDisabled
                    ]}
                    onPress={() => toggleDay(day)}
                    disabled={selectedDays.includes('everyday')}
                  >
                    <Text style={[
                      styles.dayText,
                      selectedDays.includes(day) && !selectedDays.includes('everyday') && styles.dayTextActive
                    ]}>
                      {day.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>Create Task</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#F9F9F9',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    fontSize: 16,
    color: '#333',
  },
  categoryScroll: {
    marginTop: 5,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: 'white',
  },
  reminderOption: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#eee',
    marginBottom: 10,
  },
  reminderOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  reminderOptionText: {
    fontSize: 16,
    color: '#333',
  },
  locationSet: {
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
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
  radiusOptions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  radiusChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#eee',
    borderWidth: 2,
    borderColor: '#eee',
  },
  radiusChipActive: {
    backgroundColor: '#F0F8FF',
    borderColor: '#007AFF',
  },
  radiusText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  radiusTextActive: {
    color: '#007AFF',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#eee',
  },
  dayChipActive: {
    backgroundColor: '#007AFF',
  },
  dayChipDisabled: {
    opacity: 0.5,
  },
  dayText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  dayTextActive: {
    color: 'white',
  },
  createButton: {
    backgroundColor: '#34C759',
    padding: 18,
    margin: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});