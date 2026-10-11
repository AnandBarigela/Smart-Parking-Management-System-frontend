import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api"
});

api.interceptors.request.use((config) => {
  const saved = localStorage.getItem("parkingUser");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    } catch {
      localStorage.removeItem("parkingUser");
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes("/auth/");
    const status = error.response?.status;

    // If unauthorized or forbidden on protected route, clean up expired session
    if ((status === 401 || status === 403) && !isAuthRoute) {
      if (localStorage.getItem("parkingUser")) {
        console.warn("Session expired or unauthorized. Logging out...");
        localStorage.removeItem("parkingUser");
        window.location.href = "/login?expired=true";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
