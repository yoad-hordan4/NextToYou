import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, ListRenderItem, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';

// IMPORT CONFIGURATION (This connects to Config.ts)
import { API_URL, PROXIMITY_URL, API_HEADERS } from '@/constants/config';

interface Task {
  id: string;
  title: string;
  category: string;
  is_completed: boolean;
}

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Supermarket');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
    startLocationTracking();
  }, []);

  // --- LOCATION LOGIC ---
  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission denied');
      return;
    }

    await Location.watchPositionAsync(
      { 
        accuracy: Location.Accuracy.High, 
        distanceInterval: 10 // Update every 10 meters
      },
      (newLocation) => {
        setLocation(newLocation);
        checkProximity(newLocation.coords.latitude, newLocation.coords.longitude);
      }
    );
  };

  const checkProximity = async (lat: number, lon: number) => {
    try {
      const response = await fetch(PROXIMITY_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      
      const data = await response.json();
      
      if (data.nearby && data.nearby.length > 0) {
        // Find the best deal
        const deal = data.nearby[0];
        const itemFound = deal.found_items[0];
        
        Alert.alert(
          "🎯 Deal Found!", 
          `At ${deal.store}:\nFound ${itemFound.item} for ${itemFound.price}₪`
        );
      }
    } catch (e) { 
      console.log("Proximity check failed (silent)", e); 
    }
  };

  // --- TASK LOGIC ---
  const fetchTasks = async () => {
    try {
      const response = await fetch(API_URL, { headers: API_HEADERS });
      if (response.ok) {
        setTasks(await response.json());
      }
    } catch (e) { 
      console.error("Fetch error", e); 
    }
  };

  const addTask = async () => {
    if (!text) return;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ title: text, category, is_completed: false }),
      });
      
      if (response.ok) {
        setText('');
        fetchTasks();
      } else {
        alert("Server Error: " + await response.text());
      }
    } catch (e) { 
      alert("Connection Error.\nCheck Config.ts and ensure Server is running."); 
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: API_HEADERS });
      fetchTasks();
    } catch (e) {
      console.error("Delete error", e);
    }
  };

  // --- RENDER UI ---
  const renderItem: ListRenderItem<Task> = ({ item }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <Text style={styles.taskCategory}>{item.category}</Text>
      </View>
      <TouchableOpacity onPress={() => deleteTask(item.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        
        <Text style={styles.header}>NextToYou</Text>
        <Text style={styles.subHeader}>
            {location 
              ? `📍 ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` 
              : errorMsg || "Locating..."}
        </Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputWrapper}>
            <TextInput 
              style={styles.input} 
              placeholder="Add item..." 
              value={text} 
              onChangeText={setText} 
            />
            <Button title="Add" onPress={addTask} />
          </View>
          
          <View style={styles.categoryRow}>
            {['Supermarket', 'Pharmacy', 'Hardware'].map((cat) => (
              <TouchableOpacity 
                key={cat} 
                style={[styles.catButton, category === cat && styles.catButtonActive]} 
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>

        <FlatList 
          data={tasks} 
          keyExtractor={(i) => i.id} 
          renderItem={renderItem} 
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  contentContainer: { flex: 1, padding: 20 },
  header: { fontSize: 32, fontWeight: '800', marginTop: 20, color: '#333' },
  subHeader: { color: '#007AFF', marginBottom: 20, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  catButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#ddd' },
  catButtonActive: { backgroundColor: '#007AFF' },
  catText: { color: '#333', fontWeight: '500' },
  catTextActive: { color: 'white' },
  taskItem: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity:0.1, shadowRadius:2 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { color: '#888', marginTop: 2 },
  deleteBtn: { padding: 5 },
  deleteText: { color: '#007AFF', fontWeight: '600' }
});