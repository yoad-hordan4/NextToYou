import { Platform } from 'react-native';

// ---------------------------------------------------------
// ⚙️ SERVER CONFIGURATION
// ---------------------------------------------------------

// switch between for local aand onrender server
const LIVE_SERVER_URL = 'https://nexttoyou.onrender.com'; 

const LOCAL_SERVER_URL = 'http://localhost:8000';

// Logic to pick the right server automatically
const getBaseUrl = () => {
    // If we are on the web, use localhost. If on a phone, use the Cloud.
    if (Platform.OS === 'web') return LOCAL_SERVER_URL;
    return LIVE_SERVER_URL;
};

export const API_BASE = getBaseUrl();
export const API_URL = `${API_BASE}/tasks`;
export const PROXIMITY_URL = `${API_BASE}/check-proximity`;

// Headers (Cleaned up for Cloud)
export const API_HEADERS = {
    'Content-Type': 'application/json',
};