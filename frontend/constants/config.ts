import { Platform } from 'react-native';

// ---------------------------------------------------------
// ⚙️ SERVER CONFIGURATION
// ---------------------------------------------------------

// 🔴 TODO: PASTE YOUR EXACT RENDER URL HERE (Check Render Dashboard!)
// It usually looks like: https://nexttoyou-backend-xyz.onrender.com
const LIVE_SERVER_URL = 'https://nexttoyou.onrender.com'; 

// Local URL (For Web Testing)
const LOCAL_SERVER_URL = 'http://localhost:8000';

const getBaseUrl = () => {
    if (Platform.OS === 'web') return LOCAL_SERVER_URL;
    return LIVE_SERVER_URL;
};

export const API_BASE = getBaseUrl();
export const API_URL = `${API_BASE}/tasks`;
export const PROXIMITY_URL = `${API_BASE}/check-proximity`;

export const API_HEADERS = {
    'Content-Type': 'application/json',
};