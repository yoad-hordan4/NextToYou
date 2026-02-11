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
  
  // Map Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemDeals, setItemDeals] = useState<any[]>([]);
  
  const notifiedDealsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkLogin();
    setupNotifications();
    
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { url?: string };
      if (data?.url) Linking.openURL(data.url);
    });
    return () => subscription.remove();
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

  const startSmartTracking = async (userData: any) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Location Required", "Please enable location to use this app");
      return;
    }

    const checkTimeAndTrack = async () => {
        const session = await AsyncStorage.getItem('user_session');
        if (!session) { setIsTracking(false); return; }

        const currentHour = new Date().getHours();
        const { active_start_hour, active_end_hour } = userData;
        const isActiveTime = currentHour >= active_start_hour && currentHour < active_end_hour;

        if (isActiveTime) {
            setIsTracking(true);
            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);
            console.log(`[DEBUG] Location updated: ${loc.coords.latitude}, ${loc.coords.longitude}`);
            checkProximity(loc.coords.latitude, loc.coords.longitude, userData.username);
        } else {
            setIsTracking(false);
        }
    };
    
    // Get initial location
    try {
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      console.log(`[DEBUG] Initial location: ${loc.coords.latitude}, ${loc.coords.longitude}`);
    } catch (e) {
      console.log("[ERROR] Failed to get location:", e);
    }
    
    checkTimeAndTrack();
    const intervalId = setInterval(checkTimeAndTrack, 30000); 
    return () => clearInterval(intervalId);
  };

  const checkProximity = async (lat: number, lon: number, userId: string) => {
    try {
      console.log(`[DEBUG] Checking proximity at ${lat}, ${lon}`);
      const response = await fetch(`${API_BASE}/check-proximity`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ latitude: lat, longitude: lon, user_id: userId }),
      });
      const data = await response.json();
      console.log(`[DEBUG] Proximity response:`, data);
      
      const currentDeals = data.nearby || [];
      const currentDealIds = new Set<string>();
      
      for (const deal of currentDeals) {
        for (const foundItem of deal.found_items) {
             const uniqueId = `${deal.store}|${foundItem.item}`;
             currentDealIds.add(uniqueId);
             if (!notifiedDealsRef.current.has(uniqueId)) {
                 console.log(`[DEBUG] Sending notification for ${uniqueId}`);
                 await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `🎯 Near ${deal.store}!`,
                        body: `Found: ${foundItem.item} (₪${foundItem.price}) - ${deal.distance}m away`,
                        data: { url: `maps://0,0?q=${deal.lat},${deal.lon}(${deal.store})` },
                    },
                    trigger: null,
                 });
             }
        }
      }
      notifiedDealsRef.current = currentDealIds;
    } catch (e) { 
      console.log("[ERROR] Proximity error", e); 
    }
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
    
    console.log(`[DEBUG] Adding task: ${text}`);
    
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ title: text, category: selectedCategory, user_id: user.username }),
    });
    
    // Immediately check if nearby when adding
    if (location) {
      console.log(`[DEBUG] Checking for newly added item immediately`);
      await performSearchAndNotify(text, location.coords.latitude, location.coords.longitude);
    }
    
    setText('');
    fetchTasks(user.username);
  };

  const performSearchAndNotify = async (query: string, lat: number, lon: number) => {
    try {
        const response = await fetch(`${API_BASE}/search-item`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ latitude: lat, longitude: lon, item_name: query, radius: 10000 }),
        });
        const data = await response.json();
        const results = data.results || [];
        
        console.log(`[DEBUG] Search results for "${query}":`, results.length);
        
        // Send notification for any nearby results
        if (results.length > 0) {
            const nearestStore = results[0];
            const item = nearestStore.found_items[0];
            
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `✨ Found "${query}"!`,
                    body: `${nearestStore.store} has it for ₪${item.price} - ${nearestStore.distance}m away`,
                    data: { url: `maps://0,0?q=${nearestStore.lat},${nearestStore.lon}(${nearestStore.store})` },
                },
                trigger: null,
            });
        }
    } catch (e) { 
      console.log("[ERROR] Search and notify error", e); 
    }
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditModalText(task.title);
    setSelectedItem(task.title);
    setModalVisible(true);
    if (location) performSearch(task.title, location.coords.latitude, location.coords.longitude);
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
    
    if (location) performSearch(editModalText, location.coords.latitude, location.coords.longitude);
    
    Alert.alert("Updated!", "Item updated and map refreshed.");
  };

  const deleteTask = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE', headers: API_HEADERS });
    fetchTasks(user.username);
  };

  const performSearch = async (query: string, lat: number, lon: number) => {
      try {
          console.log(`[DEBUG] Performing search for "${query}" at ${lat}, ${lon}`);
          
          const response = await fetch(`${API_BASE}/search-item`, {
              method: 'POST',
              headers: API_HEADERS,
              body: JSON.stringify({ latitude: lat, longitude: lon, item_name: query, radius: 10000 }),
          });
          
          const data = await response.json();
          const results = data.results || [];
          
          console.log(`[DEBUG] Got ${results.length} results`);
          console.log(`[DEBUG] Results:`, JSON.stringify(results, null, 2));
          
          setItemDeals(results);
      } catch (e) { 
        console.log("[ERROR] Search error", e); 
      }
  };

  const openItemMenu = (itemTitle: string) => {
    if (!location) { 
      alert("Getting your location..."); 
      return; 
    }
    
    console.log(`[DEBUG] Opening item menu for: ${itemTitle}`);
    
    setEditingTaskId(null);
    setSelectedItem(itemTitle);
    setModalVisible(true);
    performSearch(itemTitle, location.coords.latitude, location.coords.longitude);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
            <Text style={styles.header}>My List</Text>
            <View style={{flexDirection: 'row', gap: 15}}>
              <TouchableOpacity onPress={logout}><Text style={{color:'blue'}}>Logout</Text></TouchableOpacity>
              <TouchableOpacity onPress={deleteAccount}><Text style={{color:'red'}}>Delete</Text></TouchableOpacity>
            </View>
        </View>
        <Text style={styles.subHeader}>
          {isTracking ? "🟢 Active & Searching" : "🌙 Sleeping (Outside Active Hours)"}
          {location && ` • 📍 ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`}
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
               {location && itemDeals.length > 0 && (
                <MapView 
                  style={styles.map} 
                  provider={PROVIDER_DEFAULT} 
                  showsUserLocation={true}
                  initialRegion={{ 
                    latitude: location.coords.latitude, 
                    longitude: location.coords.longitude, 
                    latitudeDelta: 0.05, 
                    longitudeDelta: 0.05 
                  }}
                >
                  {itemDeals.map((deal, index) => (
                    <Marker 
                      key={`${deal.store_id}-${index}`}
                      coordinate={{ latitude: deal.lat, longitude: deal.lon }} 
                      title={deal.store}
                      description={`${deal.distance}m away • ${deal.found_items.length} item(s)`}
                      pinColor={index === 0 ? 'red' : 'orange'}
                    />
                  ))}
                </MapView>
               )}
               {location && itemDeals.length === 0 && (
                 <View style={styles.noResults}>
                   <Text style={styles.noResultsText}>No stores found nearby</Text>
                   <Text style={styles.noResultsSubtext}>Try searching for a different item</Text>
                 </View>
               )}
            </View>

            <FlatList 
              data={itemDeals} 
              keyExtractor={(item, index) => `${item.store_id}-${index}`}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>No results found</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View style={styles.dealCard}>
                  <View style={styles.dealInfo}>
                    <View style={styles.storeHeader}>
                      <Text style={styles.storeName}>
                        {index === 0 && '🥇 '}{item.store}
                      </Text>
                      <Text style={styles.distanceText}>📍 {item.distance}m</Text>
                    </View>
                    <Text style={styles.storeAddress}>{item.address}</Text>
                    {item.found_items.map((foundItem: any, idx: number) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>• {foundItem.item}</Text>
                        <Text style={styles.priceTag}>₪{foundItem.price}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity 
                    style={styles.goButton} 
                    onPress={() => Linking.openURL(`maps://0,0?q=${item.lat},${item.lon}(${item.store})`)}>
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
  subHeader: { color: '#666', marginBottom: 20, marginTop: 5, fontSize: 12 },
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
  mapContainer: { height: 300, width: '100%', marginBottom: 10, backgroundColor: '#f0f0f0' },
  map: { width: '100%', height: '100%' },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noResultsText: { fontSize: 16, fontWeight: '600', color: '#666' },
  noResultsSubtext: { fontSize: 12, color: '#999', marginTop: 4 },
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
  goButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  emptyList: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14 }
});