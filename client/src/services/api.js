import axios from 'axios';

// In production (Vercel), point to Railway backend
// In development (localhost), use Vite proxy (/api -> localhost:5000)
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const API = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle global response errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default API;
