import axios from 'axios';

// In production (Vercel), point to relative /api path or VITE_API_URL
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically attach Authorization token to every request if available
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('balaji_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle global response errors & 401 unauthorized status
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear invalid token if unauthorized
      localStorage.removeItem('balaji_token');
      localStorage.removeItem('balaji_user');
    }
    return Promise.reject(error);
  }
);

export default API;

