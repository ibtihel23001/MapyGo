import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — attach access token ────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — refresh token on 401 ─────────────
let refreshing = false;
let queue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      refreshing = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken: string = data.data?.accessToken ?? data.accessToken;
        localStorage.setItem('accessToken', newToken);
        queue.forEach((p) => p.resolve(newToken));
        queue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (err) {
        queue.forEach((p) => p.reject(err));
        queue = [];
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        refreshing = false;
      }
    }

    const message: string =
      error.response?.data?.message ?? error.message ?? 'Something went wrong';

    // Don't toast 401 (handled above) or 404 from GET
    if (error.response?.status !== 401 && error.response?.status !== 404) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

export default api;
