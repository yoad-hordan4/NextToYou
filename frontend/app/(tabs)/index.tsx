import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Alert, Platform, Modal, Linking, LayoutAnimation, UIManager } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

// Enable Animations for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- NOTIFICATION SETUP ---
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
  // User & Data State
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Supermarket');
  
  // Location & Tracking State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  // Modal & Map State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  
  const lastNotificationTime = useRef<number>(0);
  
  useEffect(() => {
    checkLogin();
    setupNotifications(); // <--- ADD THIS CALL
  }, []);

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission missing', 'Enable notifications to get proximity alerts!');
    }
  };
  // 1. AUTH CHECK
  const checkLogin = async () => {
    const session = await AsyncStorage.getItem('user_session');
    if (!session) {
      // Redirect to login if no session found
      router.replace('/login'); 
      return;
    }
    const userData = JSON.parse(session);
    setUser(userData);
    
    // Load data for this user
    fetchTasks(userData.username);
    startSmartTracking(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user_session');
    router.replace('/login');
  };

  // 2. SMART TRACKING (Battery Saver)
  const startSmartTracking = async (userData: any) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // Function to check time and decide whether to pull GPS
    const checkTimeAndTrack = async () => {
        const currentHour = new Date().getHours();
        const { active_start_hour, active_end_hour } = userData;

        // Check if current time is within user's active window
        // (Handling simpler case where start < end. If start > end (overnight), logic needs slight tweak)
        const isActiveTime = currentHour >= active_start_hour && currentHour < active_end_hour;

        if (isActiveTime) {
            setIsTracking(true);
            // Get single accurate location to save battery vs continuous watch
            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
            checkProximity(loc.coords.latitude, loc.coords.longitude, userData.username);
        } else {
            setIsTracking(false);
            console.log("Sleeping... outside active hours.");
        }
    };

    // Run immediately
    checkTimeAndTrack();
    
    // Then run every 30 seconds
    const intervalId = setInterval(checkTimeAndTrack, 30000); 
    return () => clearInterval(intervalId);
  };

  const checkProximity = async (lat: number, lon: number, userId: string) => {
    const now = Date.now();
    // 2-minute cooldown between alerts
    if (now - lastNotificationTime.current < 120000) return;

    try {
      const response = await fetch(`${API_BASE}/check-proximity`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ 
            latitude: lat, 
            longitude: lon,
            user_id: userId 
        }),
      });
      const data = await response.json();
      
      if (data.nearby && data.nearby.length > 0) {
        const bestDeal = data.nearby[0];
        const item = bestDeal.found_items[0];
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎯 Near ${bestDeal.store}!`,
            body: `Don't forget: ${item.item} (${item.price}₪)`,
            data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}(${bestDeal.store})` },
          },
          trigger: null,
        });
        lastNotificationTime.current = now;
      }
    } catch (e) { console.log("Proximity error", e); }
  };

  // 3. UI ACTIONS
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

  // 4. CRUD OPERATIONS
  const fetchTasks = async (username: string) => {
    if (!username) return;
    try {
        const res = await fetch(`${API_BASE}/tasks/${username}`, { headers: API_HEADERS });
        if (res.ok) setTasks(await res.json());
    } catch(e) { console.log(e); }
  };

  const addTask = async () => {
    if (!text || !user) return;
    
    // 1. Save the task to the server
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ 
          title: text, 
          category, 
          is_completed: false,
          user_id: user.username
      }),
    });
    
    const newItem = text; // Remember what we just added
    setText('');
    fetchTasks(user.username);

    // 2. INSTANT CHECK (Specific to the NEW item only)
    if (location) {
        console.log(`Checking deals specifically for: ${newItem}`);
        
        try {
            // Ask the server: "Is THIS item near me right now?"
            const res = await fetch(`${API_BASE}/search-item`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify({ 
                    latitude: location.coords.latitude, 
                    longitude: location.coords.longitude,
                    item_name: newItem 
                }),
            });
            
            const data = await res.json();
            
            // If we found a deal for THIS item, notify immediately
            if (data.results && data.results.length > 0) {
                const bestDeal = data.results[0];
                const item = bestDeal.found_items[0];

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `🎯 Found ${item.item}!`, // "Found Water!"
                        body: `At ${bestDeal.store} (${bestDeal.distance}m) - ${item.price}₪`,
                        data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}(${bestDeal.store})` },
                    },
                    trigger: null,
                });
            }
        } catch (e) { console.log("Instant check failed", e); }
    }
  };

  const deleteTask = async (id: string) => {
    // Smooth Animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks(user.username);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        
        {/* Header with Logout */}
        <View style={styles.headerRow}>
            <Text style={styles.header}>My List</Text>
            <TouchableOpacity onPress={logout}>
                <Text style={{color:'blue', fontWeight:'600'}}>Logout</Text>
            </TouchableOpacity>
        </View>
        
        {/* Status Indicator */}
        <Text style={styles.subHeader}>
            {isTracking ? "🟢 Active & Searching" : "🌙 Sleeping (Outside Active Hours)"}
        </Text>

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

        {/* --- MAP MODAL (Full Implementation) --- */}
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  header: { fontSize: 32, fontWeight: '800', color: '#333' },
  subHeader: { color: '#666', marginBottom: 20, marginTop: 5 },
  inputWrapper: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
  taskItem: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { color: '#888', fontSize: 12 },
  deleteText: { color: 'red', fontWeight: '600' },
  
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', zIndex: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  
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