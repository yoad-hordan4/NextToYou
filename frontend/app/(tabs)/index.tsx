import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, FlatList, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Alert, Platform, Modal, Linking, LayoutAnimation, UIManager, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE, API_HEADERS } from '@/constants/config';

// Enable Animations
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- 🔔 1. IOS SOUND HANDLER ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true, 
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CATEGORIES = ["Supermarket", "Pharmacy", "Hardware", "Pet Shop", "Post Office", "General"];

interface Task {
  id: string;
  title: string;
  category: string;
}

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Supermarket');
  
  // Edit Mode
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editModalText, setEditModalText] = useState('');

  // Location
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('Never');
  
  // Map Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  
  const notifiedDealsRef = useRef<Set<string>>(new Set());
  
  // 🛑 Tracker Subscription Reference
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    checkLogin();
    setupNotifications();
    
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { url?: string };
      if (data?.url) Linking.openURL(data.url);
    });
    return () => {
        subscription.remove();
        stopTracking(); 
    };
  }, []);

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') Alert.alert('Permission missing', 'Enable notifications for alerts!');
  };

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
    stopTracking();
    await AsyncStorage.removeItem('user_session');
    notifiedDealsRef.current.clear();
    router.replace('/login');
  };

  const deleteAccount = async () => {
    Alert.alert("Delete Account", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          if (!user) return;
          try {
            await fetch(`${API_BASE}/delete-account`, {
              method: 'POST',
              headers: API_HEADERS,
              body: JSON.stringify({ username: user.username, password: user.password })
            });
            logout();
          } catch (e) { alert("Network error"); }
        }
      }
    ]);
  };

  const stopTracking = () => {
      if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
      }
      setIsTracking(false);
  };

  // --- 🚀 REAL-TIME MOVEMENT TRACKING ---
  const startSmartTracking = async (userData: any) => {
    stopTracking();

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // Check "Active Hours"
    const currentHour = new Date().getHours();
    const { active_start_hour, active_end_hour } = userData;
    const isActiveTime = currentHour >= active_start_hour && currentHour < active_end_hour;

    if (!isActiveTime) {
        setIsTracking(false);
        return; 
    }

    setIsTracking(true);

    try {
        const sub = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High, 
                distanceInterval: 5,              
            },
            (newLoc) => {
                setLocation(newLoc);
                setLastCheckTime(new Date().toLocaleTimeString());
                checkProximity(newLoc.coords.latitude, newLoc.coords.longitude, userData.username);
            }
        );
        locationSubscription.current = sub;
    } catch (e) {
        console.log("Error starting watchPosition:", e);
    }
  };

  const checkProximity = async (lat: number, lon: number, userId: string) => {
    try {
      const response = await fetch(`${API_BASE}/check-proximity`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ latitude: lat, longitude: lon, user_id: userId }),
      });
      const data = await response.json();
      const currentDeals = data.nearby || [];
      const currentDealIds = new Set<string>();
      
      for (const deal of currentDeals) {
        for (const foundItem of deal.found_items) {
             const uniqueId = `${deal.store}|${foundItem.item}`;
             currentDealIds.add(uniqueId);
             
             if (!notifiedDealsRef.current.has(uniqueId)) {
                 await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `🎯 Near ${deal.store}!`,
                        body: `Found: ${foundItem.item} (₪${foundItem.price}) - ${deal.distance}m away`,
                        data: { url: `maps://0,0?q=${deal.lat},${deal.lon}(${deal.store})` },
                        sound: 'default',
                    },
                    trigger: null,
                 });
             }
        }
      }
      notifiedDealsRef.current = currentDealIds;
    } catch (e) { console.log("Proximity error", e); }
  };

  const fetchTasks = async (username: string) => {
    if (!username) return;
    try {
        const res = await fetch(`${API_BASE}/tasks/${username}`, { headers: API_HEADERS });
        if (res.ok) setTasks(await res.json());
    } catch(e) { console.log(e); }
  };

  const handleAdd = async () => {
    if (!text || !user) return;
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ title: text, category: selectedCategory, user_id: user.username }),
    });
    if (location) performSearch(text, location.coords.latitude, location.coords.longitude, true);
    setText('');
    fetchTasks(user.username);
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditModalText(task.title);
    setSelectedItem(task.title);
    setModalVisible(true);
    if (location) performSearch(task.title, location.coords.latitude, location.coords.longitude, false);
  };

  const saveEditInModal = async () => {
    if (!editingTaskId || !editModalText || !user) return;
    await fetch(`${API_BASE}/tasks/${editingTaskId}`, {
        method: 'PUT',
        headers: API_HEADERS,
        body: JSON.stringify({ title: editModalText }),
    });
    fetchTasks(user.username);
    setSelectedItem(editModalText);
    setEditingTaskId(null);
    if (location) performSearch(editModalText, location.coords.latitude, location.coords.longitude, false);
    Alert.alert("Updated!", "Item updated and map refreshed.");
  };

  const deleteTask = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks(user.username);
  };

  const performSearch = async (query: string, lat: number, lon: number, isInstantCheck: boolean) => {
      try {
          const response = await fetch(`${API_BASE}/search-item`, {
              method: 'POST',
              headers: API_HEADERS,
              body: JSON.stringify({ latitude: lat, longitude: lon, item_name: query }),
          });
          const data = await response.json();
          const results = data.results || [];
          
          if (!isInstantCheck) setItemDeals(results);
          
          const notifyRadius = user?.notification_radius || 50; 

          if (isInstantCheck && results.length > 0) {
              const bestDeal = results[0];
              if (bestDeal.distance <= notifyRadius) {
                  const item = bestDeal.found_items[0];
                  await Notifications.scheduleNotificationAsync({
                      content: {
                          title: `🎯 Found ${item.item}!`,
                          body: `At ${bestDeal.store} - ${item.price}₪`,
                          data: { url: `maps://0,0?q=${bestDeal.lat},${bestDeal.lon}` },
                          sound: 'default',
                      },
                      trigger: null,
                  });
              }
          }
      } catch (e) { console.log("Search error", e); }
  };

  const openItemMenu = (itemTitle: string) => {
    if (!location) { alert("Locating you..."); return; }
    setEditingTaskId(null);
    setSelectedItem(itemTitle);
    setModalVisible(true);
    performSearch(itemTitle, location.coords.latitude, location.coords.longitude, false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        
        {/* --- MODIFIED HEADER WITH SETTINGS --- */}
        <View style={styles.headerRow}>
            <Text style={styles.header}>My List</Text>
            <View style={{flexDirection: 'row', gap: 15, alignItems: 'center'}}>
              
              {/* ⚙️ SETTINGS BUTTON (Goes to /settings page) */}
              <TouchableOpacity onPress={() => router.push('/settings')}>
                  <Text style={{fontSize: 24}}>⚙️</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={logout}><Text style={{color:'blue'}}>Logout</Text></TouchableOpacity>
              <TouchableOpacity onPress={deleteAccount}><Text style={{color:'red'}}>Delete</Text></TouchableOpacity>
            </View>
        </View>
        
        {/* VISUAL DEBUGGER */}
        <Text style={styles.subHeader}>
          {isTracking ? "🟢 Active & Watching Movement" : "🌙 Sleeping"}
          {location && ` • 📍 Loc OK`}
        </Text>
        <Text style={{fontSize: 10, color: '#999', marginBottom: 15, textAlign:'center'}}>
            Updated: {lastCheckTime} | Radius: {user?.notification_radius || 50}m
        </Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.inputCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}
                  style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}>
                  <Text style={[styles.catText, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.inputWrapper}>
              <TextInput style={styles.input} placeholder="Add new item..." value={text} onChangeText={setText} />
              <Button title="Add" onPress={handleAdd} />
            </View>
          </View>
        </KeyboardAvoidingView>

        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.taskItem}>
              <TouchableOpacity style={{flex: 1}} onPress={() => openItemMenu(item.title)}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskCategory}>{item.category}</Text>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}><Text style={{color: '#007AFF'}}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteTask(item.id)}><Text style={styles.deleteText}>Done</Text></TouchableOpacity>
              </View>
            </View>
          )}
        />

        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              {editingTaskId ? (
                 <View style={styles.editHeaderContainer}>
                    <Text style={styles.editLabel}>Rename Item:</Text>
                    <View style={styles.editRow}>
                        <TextInput style={styles.editInput} value={editModalText} onChangeText={setEditModalText} />
                        <TouchableOpacity style={styles.saveBtn} onPress={saveEditInModal}>
                            <Text style={{color: 'white', fontWeight: 'bold'}}>Update</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
              ) : ( 
                <View>
                  <Text style={styles.modalTitle}>Searching: {selectedItem}</Text>
                  <Text style={styles.modalSubtitle}>{itemDeals.length} location{itemDeals.length !== 1 ? 's' : ''} found</Text>
                </View>
              )}
              <Button title="Close" onPress={() => setModalVisible(false)} />
            </View>

            <View style={styles.mapContainer}>
               {location && (
                <MapView style={styles.map} provider={PROVIDER_DEFAULT} showsUserLocation={true}
                  initialRegion={{ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 }}>
                  {itemDeals.map((deal, index) => (
                    <Marker 
                        key={index} 
                        coordinate={{ latitude: deal.lat, longitude: deal.lon }} 
                        title={deal.store}
                        description={`${deal.distance}m away`} 
                    />
                  ))}
                </MapView>
               )}
            </View>

            <FlatList data={itemDeals} keyExtractor={(item, index) => index.toString()}
              renderItem={({ item, index }) => (
                <View style={styles.dealCard}>
                  <View style={styles.dealInfo}>
                    <View style={styles.storeHeader}>
                        <Text style={styles.storeName}>{index === 0 && '🥇 '}{item.store}</Text>
                        <Text style={styles.distanceText}>📍 {item.distance}m</Text>
                    </View>
                    {item.address && <Text style={styles.storeAddress}>{item.address}</Text>}
                    {item.found_items.map((foundItem: any, idx: number) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>• {foundItem.item}</Text>
                        <Text style={styles.priceTag}>₪{foundItem.price}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.goButton} onPress={() => Linking.openURL(`maps://0,0?q=${item.lat},${item.lon}`)}>
                    <Text style={styles.goButtonText}>GO</Text>
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
  subHeader: { color: '#666', marginBottom: 2, marginTop: 5, fontSize: 12 },
  inputCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 3 },
  inputWrapper: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F9F9F9', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#eee', marginRight: 8 },
  catChipActive: { backgroundColor: '#007AFF' },
  catText: { color: '#666', fontSize: 12, fontWeight: '600' },
  catTextActive: { color: 'white' },
  taskItem: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2 },
  taskTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  taskCategory: { color: '#888', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 15 },
  editBtn: { marginRight: 5 },
  deleteText: { color: 'red', fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white', zIndex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  editHeaderContainer: { flex: 1, marginRight: 10 },
  editLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  editRow: { flexDirection: 'row', gap: 10 },
  editInput: { flex: 1, backgroundColor: '#F5F5F5', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  saveBtn: { backgroundColor: '#007AFF', padding: 10, borderRadius: 8, justifyContent: 'center' },
  mapContainer: { height: 300, width: '100%', marginBottom: 10 },
  map: { width: '100%', height: '100%' },
  dealCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  dealInfo: { flex: 1 },
  storeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  storeName: { fontSize: 18, fontWeight: '700', color: '#333' },
  storeAddress: { fontSize: 12, color: '#888', marginBottom: 8 },
  distanceText: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingLeft: 8 },
  itemName: { fontSize: 14, color: '#555', flex: 1 },
  priceTag: { color: '#22C55E', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  goButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25 },
  goButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});