import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Alert, Platform, Modal, Linking, LayoutAnimation, UIManager, ScrollView } from 'react-native';
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

// --- CONSTANTS ---
const CATEGORIES = [
  "Supermarket", "Pharmacy", "Hardware", "Pet Shop", "Post Office", "Phone Repair", "General"
];

interface Task {
  id: string;
  title: string;
  category: string;
}

export default function HomeScreen() {
  // --- STATE ---
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Inputs
  const [text, setText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Supermarket');
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Location & Tracking
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  // Modal & Map
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  
  // Smart Notifications Memory
  const notifiedDealsRef = useRef<Set<string>>(new Set());

  // --- INITIALIZATION ---
  useEffect(() => {
    checkLogin();
    setupNotifications();

    // LISTENER: Handle tapping on notifications to open Maps
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { url?: string };
      if (data?.url) {
        Linking.openURL(data.url); 
      }
    });

    return () => subscription.remove();
  }, []);

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission missing', 'Enable notifications to get proximity alerts!');
    }
  };

  // --- AUTH ---
  const checkLogin = async () => {
    const session = await AsyncStorage.getItem('user_session');
    if (!session) {
      router.replace('/login'); 
      return;
    }
    const userData = JSON.parse(session);
    setUser(userData);
    fetchTasks(userData.username);
    startSmartTracking(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user_session');
    notifiedDealsRef.current.clear();
    router.replace('/login');
  };

  const deleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            if (!user) return;
            try {
              const res = await fetch(`${API_BASE}/delete-account`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify({ username: user.username, password: user.password })
              });
              if (res.ok) {
                await AsyncStorage.removeItem('user_session');
                router.replace('/login');
              } else {
                alert("Failed to delete account");
              }
            } catch (e) { alert("Network error"); }
          }
        }
      ]
    );
  };

  // --- SMART TRACKING & PROXIMITY ---
  const startSmartTracking = async (userData: any) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const checkTimeAndTrack = async () => {
        const session = await AsyncStorage.getItem('user_session');
        if (!session) {
            setIsTracking(false);
            return; 
        }

        const currentHour = new Date().getHours();
        const { active_start_hour, active_end_hour } = userData;
        const isActiveTime = currentHour >= active_start_hour && currentHour < active_end_hour;

        if (isActiveTime) {
            setIsTracking(true);
            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
            checkProximity(loc.coords.latitude, loc.coords.longitude, userData.username);
        } else {
            setIsTracking(false);
        }
    };

    checkTimeAndTrack();
    const intervalId = setInterval(checkTimeAndTrack, 30000); 
    return () => clearInterval(intervalId);
  };

  const checkProximity = async (lat: number, lon: number, userId: string) => {
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
      
      const currentDeals = data.nearby || [];
      const currentDealIds = new Set<string>();
      const newDealsToNotify = [];

      for (const deal of currentDeals) {
        for (const foundItem of deal.found_items) {
             const uniqueId = `${deal.store}|${foundItem.item}`;
             currentDealIds.add(uniqueId);

             if (!notifiedDealsRef.current.has(uniqueId)) {
                 newDealsToNotify.push({ store: deal, item: foundItem });
             }
        }
      }

      for (const { store, item } of newDealsToNotify) {
          await Notifications.scheduleNotificationAsync({
              content: {
                  title: `🎯 Near ${store.store}!`,
                  body: `Found: ${item.item} (${item.price}₪)`,
                  data: { url: `maps://0,0?q=${store.lat},${store.lon}(${store.store})` },
              },
              trigger: null,
          });
      }

      notifiedDealsRef.current = currentDealIds;

    } catch (e) { console.log("Proximity error", e); }
  };

  // --- CRUD ACTIONS (Tasks) ---
  const fetchTasks = async (username: string) => {
    if (!username) return;
    try {
        const res = await fetch(`${API_BASE}/tasks/${username}`, { headers: API_HEADERS });
        if (res.ok) setTasks(await res.json());
    } catch(e) { console.log(e); }
  };

  const handleAddOrUpdate = async () => {
    if (!text || !user) return;
    
    // 1. EDIT MODE
    if (isEditing && editingTaskId) {
      await fetch(`${API_BASE}/tasks/${editingTaskId}`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify({ 
            title: text, 
            category: selectedCategory 
        }),
      });
      // Reset Edit State
      setIsEditing(false);
      setEditingTaskId(null);

    } else {
      // 2. ADD MODE
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ 
            title: text, 
            category: selectedCategory, 
            is_completed: false,
            user_id: user.username
        }),
      });
      
      // Instant Check for new item
      if (location) {
          try {
              const res = await fetch(`${API_BASE}/search-item`, {
                  method: 'POST',
                  headers: API_HEADERS,
                  body: JSON.stringify({ 
                      latitude: location.coords.latitude, 
                      longitude: location.coords.longitude,
                      item_name: text 
                  }),
              });
              const data = await res.json();
              if (data.results && data.results.length > 0) {
                  const bestDeal = data.results[0];
                  if (bestDeal.distance < 500) {
                      const item = bestDeal.found_items[0];
                      await Notifications.scheduleNotificationAsync({
                          content: {
                              title: `🎯 Found ${item.item}!`,
                              body: `At ${bestDeal.store} (${bestDeal.distance}m) - ${item.price}₪`,
                              data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}(${bestDeal.store})` },
                          },
                          trigger: null,
                      });
                  }
              }
          } catch (e) { console.log("Instant check failed", e); }
      }
    }
    
    setText('');
    fetchTasks(user.username);
  };

  const startEdit = (task: Task) => {
    setText(task.title);
    setSelectedCategory(task.category);
    setIsEditing(true);
    setEditingTaskId(task.id);
  };

  const cancelEdit = () => {
    setText('');
    setIsEditing(false);
    setEditingTaskId(null);
  };

  const deleteTask = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks(user.username);
  };

  // --- MAP & NAVIGATION ---
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        
        {/* Header */}
        <View style={styles.headerRow}>
            <Text style={styles.header}>My List</Text>
            <View style={{flexDirection: 'row', gap: 15}}>
              <TouchableOpacity onPress={logout}>
                  <Text style={{color:'blue', fontWeight:'600'}}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={deleteAccount}>
                  <Text style={{color:'red', fontWeight:'600'}}>Delete</Text>
              </TouchableOpacity>
            </View>
        </View>
        
        <Text style={styles.subHeader}>
            {isTracking ? "🟢 Active & Searching" : "🌙 Sleeping (Outside Active Hours)"}
        </Text>

        {/* --- INPUT AREA (UPDATED FOR CATEGORIES) --- */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputCard}>
            
            {/* Category Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catChip, 
                    selectedCategory === cat && styles.catChipActive
                  ]}
                >
                  <Text style={[
                    styles.catText, 
                    selectedCategory === cat && styles.catTextActive
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputWrapper}>
              <TextInput 
                style={styles.input} 
                placeholder={isEditing ? "Edit item name..." : "Add item..."} 
                value={text} 
                onChangeText={setText} 
              />
              <Button 
                title={isEditing ? "Save" : "Add"} 
                onPress={handleAddOrUpdate} 
              />
              {isEditing && (
                <Button title="Cancel" color="red" onPress={cancelEdit} />
              )}
            </View>

          </View>
        </KeyboardAvoidingView>

        {/* --- LIST --- */}
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.taskItem}>
              {/* Click to Open Map */}
              <TouchableOpacity style={{flex: 1}} onPress={() => openItemMenu(item.title)}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskCategory}>{item.category}</Text>
              </TouchableOpacity>
              
              <View style={styles.actions}>
                {/* Edit Button */}
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}>
                    <Text style={{color: '#007AFF'}}>Edit</Text>
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity onPress={() => deleteTask(item.id)}>
                    <Text style={styles.deleteText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* --- MAP MODAL --- */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Searching: {selectedItem}</Text>
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </View>

            <View style={styles.mapContainer}>
               {location && (
                <MapView
                  style={styles.map}
                  provider={PROVIDER_DEFAULT}
                  showsUserLocation={true}
                  initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.1, 
                    longitudeDelta: 0.1,
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
  
  // Input Area (New)
  inputCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 3 },
  inputWrapper: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F9F9F9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  
  // Category Chips (New)
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  catChipActive: { backgroundColor: '#007AFF' },
  catText: { color: '#666', fontSize: 12, fontWeight: '600' },
  catTextActive: { color: 'white' },

  // Task Item (Updated)
  taskItem: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { color: '#888', fontSize: 12, marginTop: 2 },
  
  // Actions
  actions: { flexDirection: 'row', gap: 15 },
  editBtn: { marginRight: 5 },
  deleteText: { color: 'red', fontWeight: '600' },
  
  // Map Modal
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