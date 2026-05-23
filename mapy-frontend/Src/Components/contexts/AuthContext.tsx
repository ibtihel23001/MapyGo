import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMe } from '../../API/hooks'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null | undefined
  isLoading: boolean
  refetch: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  isLoading: true,
  refetch: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useMe()

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

