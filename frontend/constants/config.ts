import { Platform } from 'react-native';


const LIVE_SERVER_URL = 'https://nexttoyou.onrender.com';
// Local URL (Only used for Web testing)
const LOCAL_SERVER_URL = 'http://localhost:8000';

// Logic to pick the right server automatically
const getBaseUrl = () => {
    if (Platform.OS === 'web') {
        return LOCAL_SERVER_URL;
    }
    
    // 2. If we are on the Phone (Android/iOS), use the REAL Cloud Backend
    return LIVE_SERVER_URL;
};

export const API_BASE = getBaseUrl();
export const API_URL = `${API_BASE}/tasks`;
export const PROXIMITY_URL = `${API_BASE}/check-proximity`;

export const API_HEADERS = {
    'Content-Type': 'application/json',
};