import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, Platform, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, ListRenderItem, Alert } from 'react-native';
import * as Location from 'expo-location';

// --- CONFIGURATION ---
// 1. Put your Tunnel URL here (from the terminal command: npx localtunnel --port 8000)
const TUNNEL_URL = 'https://nine-kids-grin.loca.lt'; 

// 2. Smart URL Selection:
// - Web/Simulator uses localhost (fast & reliable)
// - Real Phone uses Tunnel (bypasses network issues)
const API_BASE = Platform.OS === 'web' || Platform.OS === 'ios' ? 'http://localhost:8000' : TUNNEL_URL;

const API_URL = `${API_BASE}/tasks`;
const PROXIMITY_URL = `${API_BASE}/check-proximity`;

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
  
  // Location State
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
      setErrorMsg('Permission to access location was denied');
      return;
    }

    // Watch for changes (updates every 10 meters)
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10 
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
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' // <--- THE SECRET PASSWORD
        },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      
      const data = await response.json();
      
      if (data.nearby && data.nearby.length > 0) {
        // Sort by cheapest item found
        const bestDeal = data.nearby[0];
        const firstItem = bestDeal.found_items[0];
        
        Alert.alert(
          "🎯 Deal Found!",
          `Go to: ${bestDeal.store}\nFound: ${firstItem.item} for ${firstItem.price}₪`
        );
      }
    } catch (error) {
      console.log("Proximity check failed (silent)", error);
    }
  };

  // --- TASK LOGIC ---
  const fetchTasks = async () => {
    try {
      const response = await fetch(API_URL, {
        headers: { 'Bypass-Tunnel-Reminder': 'true' } // <--- NEEDED HERE TOO
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const addTask = async () => {
    if (!text) return;

    const newTask = {
      title: text,
      category: category,
      is_completed: false
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' // <--- AND HERE
        },
        body: JSON.stringify(newTask),
      });
      
      if (response.ok) {
        setText('');
        fetchTasks();
      } else {
        const err = await response.text();
        alert(`Server Error:\n${err}`);
      }
    } catch (error) {
      console.error("Error adding task:", error);
      alert(`Connection Failed!\nCheck that Python is running.\nTarget: ${API_URL}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`${API_URL}/${id}`, { 
        method: 'DELETE',
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });
      fetchTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

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
        
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Text style={styles.header}>NextToYou</Text>
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>
              {location 
                ? `📍 ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` 
                : 'Locating...'}
            </Text>
          </View>
        </View>
        
        {/* INPUT */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputWrapper}>
            <TextInput 
              style={styles.input} 
              placeholder="Add item (e.g. Milk)" 
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

        {/* LIST */}
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  contentContainer: { flex: 1, padding: 20 },
  headerContainer: { marginBottom: 20, marginTop: 20 },
  header: { fontSize: 32, fontWeight: '800', color: '#333' },
  locationBadge: { backgroundColor: '#e3f2fd', padding: 8, borderRadius: 8, marginTop: 5, alignSelf: 'flex-start' },
  locationText: { color: '#0d47a1', fontSize: 12, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', marginBottom: 15, gap: 10 },
  input: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 16 },
  categoryRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  catButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#E0E0E0' },
  catButtonActive: { backgroundColor: '#007AFF' },
  catText: { color: '#555', fontWeight: '600' },
  catTextActive: { color: 'white' },
  list: { flex: 1 },
  taskItem: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { fontSize: 14, color: '#888', marginTop: 4 },
  deleteBtn: { padding: 8 },
  deleteText: { color: '#007AFF', fontWeight: '600' }
});