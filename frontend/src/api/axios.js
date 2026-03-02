// src/api/axios.js
import axios from "axios";
import { socketService } from "../services/socket.service";

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Attach X-Socket-Id so the backend excludes the sender from broadcasts
api.interceptors.request.use((config) => {
  const socketId = socketService.id;
  if (socketId) config.headers["x-socket-id"] = socketId;
  return config;
});

export default api;