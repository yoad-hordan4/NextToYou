import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Alert, Platform, Modal, Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
// FIXED: Removed unused API_URL from imports
import { API_BASE, API_HEADERS } from '@/constants/config'; 

// --- NOTIFICATION SETUP ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // FIXED: Added these two required properties
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Task {
  id: string;
  title: string;
  category: string;
}

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Supermarket');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  
  // Modal State (The "Menu" for a specific item)
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Notification Cooldown (Don't spam the user)
  const lastNotificationTime = useRef<number>(0);

  useEffect(() => {
    fetchTasks();
    setupNotifications();
    startLocationTracking();
  }, []);

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Enable notifications to get proximity alerts!');
    }
  };

  // --- LOCATION & PROXIMITY ---
  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20 },
      (newLocation) => {
        setLocation(newLocation);
        checkProximity(newLocation.coords.latitude, newLocation.coords.longitude);
      }
    );
  };

  const checkProximity = async (lat: number, lon: number) => {
    // Prevent spamming notifications (only once every 2 minutes)
    const now = Date.now();
    if (now - lastNotificationTime.current < 120000) return;

    try {
      const response = await fetch(`${API_BASE}/check-proximity`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      const data = await response.json();
      
      if (data.nearby && data.nearby.length > 0) {
        const bestDeal = data.nearby[0];
        const item = bestDeal.found_items[0];
        
        // SEND PUSH NOTIFICATION
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎯 Found ${item.item}!`,
            body: `At ${bestDeal.store} (${bestDeal.distance}m away) - ${item.price}₪`,
            data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}(${bestDeal.store})` },
          },
          trigger: null, // Send immediately
        });
        
        lastNotificationTime.current = now;
      }
    } catch (e) { console.log("Proximity error", e); }
  };

  // --- UI ACTIONS ---
  const openItemMenu = async (itemTitle: string) => {
    if (!location) {
      alert("Waiting for location...");
      return;
    }
    
    setSelectedItem(itemTitle);
    setModalVisible(true);
    setItemDeals([]); // Clear previous results

    try {
      // Ask backend for stores selling THIS specific item
      const response = await fetch(`${API_BASE}/search-item`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ 
          latitude: location.coords.latitude, 
          longitude: location.coords.longitude,
          item_name: itemTitle 
        }),
      });
      const data = await response.json();
      setItemDeals(data.results || []);
    } catch (e) {
      alert("Could not fetch deals");
    }
  };

  const navigateToStore = (lat: number, lon: number, label: string) => {
    // Opens Google Maps or Apple Maps
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lon}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  // --- CRUD ---
  const fetchTasks = async () => {
    const res = await fetch(`${API_BASE}/tasks`, { headers: API_HEADERS });
    if (res.ok) setTasks(await res.json());
  };

  const addTask = async () => {
    if (!text) return;
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ title: text, category, is_completed: false }),
    });
    setText('');
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks();
  };

  // --- RENDER ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.header}>My List</Text>
        <Text style={styles.subHeader}>Tap an item to find it nearby 📍</Text>

        {/* INPUT AREA */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} placeholder="Add item..." value={text} onChangeText={setText} />
            <Button title="Add" onPress={addTask} />
          </View>
        </KeyboardAvoidingView>

        {/* MAIN TO-DO LIST */}
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.taskItem} 
              onPress={() => openItemMenu(item.title)} // <--- CLICKABLE!
            >
              <View>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskCategory}>{item.category}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteTask(item.id)}>
                <Text style={styles.deleteText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />

        {/* --- MODAL: THE MAP/LIST MENU --- */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buying: {selectedItem}</Text>
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </View>

            {itemDeals.length === 0 ? (
              <Text style={styles.loadingText}>Searching stores nearby...</Text>
            ) : (
              <FlatList
                data={itemDeals}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.dealCard}>
                    <View style={styles.dealInfo}>
                      <Text style={styles.storeName}>{item.store}</Text>
                      <Text style={styles.priceTag}>{item.found_items[0].price}₪</Text>
                      <Text style={styles.distanceText}>{item.distance}m away</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.goButton}
                      onPress={() => navigateToStore(item.lat, item.lon, item.store)}
                    >
                      <Text style={styles.goButtonText}>GO ➔</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  contentContainer: { flex: 1, padding: 20 },
  header: { fontSize: 32, fontWeight: '800', marginTop: 20, color: '#333' },
  subHeader: { color: '#666', marginBottom: 20 },
  inputWrapper: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  taskItem: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { color: '#888', fontSize: 12 },
  deleteText: { color: 'red', fontWeight: '600' },
  
  // Modal Styles
  modalContainer: { flex: 1, padding: 20, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  loadingText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#888' },
  dealCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  dealInfo: { flex: 1 },
  storeName: { fontSize: 18, fontWeight: '600' },
  priceTag: { color: 'green', fontWeight: 'bold', fontSize: 16 },
  distanceText: { color: '#888', fontSize: 12 },
  goButton: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  goButtonText: { color: 'white', fontWeight: 'bold' }
});