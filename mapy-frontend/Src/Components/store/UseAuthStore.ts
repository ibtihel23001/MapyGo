import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  setUser: (user) => set({ user }),
  setToken: (accessToken) => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
    } else {
      localStorage.removeItem('accessToken')
    }
    set({ accessToken })
  },
  logout: () => {
    localStorage.removeItem('accessToken')
    set({ user: null, accessToken: null })
  },
}))
