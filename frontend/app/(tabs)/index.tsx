import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Alert, Platform, Modal, Linking, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'; // <--- NEW MAP IMPORT
import { API_BASE, API_HEADERS } from '@/constants/config';

// Notification Setup
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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
  
  // Modal & Search State
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const lastNotificationTime = useRef<number>(0);

  useEffect(() => {
    fetchTasks();
    setupNotifications();
    startLocationTracking();
  }, []);

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') alert('Enable notifications for alerts!');
  };

  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (newLocation) => {
        setLocation(newLocation);
        checkProximity(newLocation.coords.latitude, newLocation.coords.longitude);
      }
    );
  };

  const checkProximity = async (lat: number, lon: number) => {
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
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎯 Found ${item.item}!`,
            body: `At ${bestDeal.store} (${bestDeal.distance}m) - ${item.price}₪`,
            data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}(${bestDeal.store})` },
          },
          trigger: null,
        });
        lastNotificationTime.current = now;
      }
    } catch (e) { console.log("Proximity silent error", e); }
  };

  const openItemMenu = async (itemTitle: string) => {
    if (!location) {
      alert("Locating you...");
      return;
    }
    
    setSelectedItem(itemTitle);
    setModalVisible(true);
    setItemDeals([]); 

    try {
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
    } catch (e) { alert("Network Error"); }
  };

  const navigateToStore = (lat: number, lon: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lon}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  const fetchTasks = async () => {
    const res = await fetch(`${API_BASE}/tasks`, { headers: API_HEADERS });
    if (res.ok) setTasks(await res.json());
  };

  const addTask = async () => {
    if (!text) return;
    
    // 1. הוספת המשימה לשרת
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ title: text, category, is_completed: false }),
    });
    
    setText('');
    fetchTasks();

    // 2. תיקון: בדיקה מיידית האם אני *כבר* ליד חנות עם הפריט הזה
    if (location) {
      console.log("Checking proximity for new item...");
      // אופציונלי: איפוס הטיימר כדי להבטיח שההתראה תקפוץ גם אם קיבלת אחת לפני דקה
      lastNotificationTime.current = 0; 
      checkProximity(location.coords.latitude, location.coords.longitude);
    }
  };

  const deleteTask = async (id: string) => {
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.header}>My List</Text>
        <Text style={styles.subHeader}>Tap an item to see the map 🗺️</Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputWrapper}>
            <TextInput style={styles.input} placeholder="Add item..." value={text} onChangeText={setText} />
            <Button title="Add" onPress={addTask} />
          </View>
        </KeyboardAvoidingView>

        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.taskItem} onPress={() => openItemMenu(item.title)}>
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

        {/* --- MAP MODAL --- */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Searching: {selectedItem}</Text>
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </View>

            {/* MAP VIEW */}
            <View style={styles.mapContainer}>
               {location && (
                <MapView
                  style={styles.map}
                  provider={PROVIDER_DEFAULT}
                  showsUserLocation={true}
                  initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                >
                  {/* PINS FOR STORES */}
                  {itemDeals.map((deal, index) => (
                    <Marker
                      key={index}
                      coordinate={{ latitude: deal.lat, longitude: deal.lon }}
                      title={`${deal.store} (${deal.found_items[0].price}₪)`}
                      description="Click to Navigate"
                      onCalloutPress={() => navigateToStore(deal.lat, deal.lon, deal.store)}
                    />
                  ))}
                </MapView>
               )}
            </View>

            {/* LIST BELOW MAP */}
            <FlatList
              data={itemDeals}
              style={{ flex: 1 }}
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
  
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  
  // NEW MAP STYLES
  mapContainer: { height: 300, width: '100%', marginBottom: 10 },
  map: { width: '100%', height: '100%' },

  dealCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  dealInfo: { flex: 1 },
  storeName: { fontSize: 18, fontWeight: '600' },
  priceTag: { color: 'green', fontWeight: 'bold', fontSize: 16 },
  distanceText: { color: '#888', fontSize: 12 },
  goButton: { backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  goButtonText: { color: 'white', fontWeight: 'bold' }
});