import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(
        () => Boolean(localStorage.getItem('access'))
    )

    function login(tokens) {
        localStorage.setItem('access', tokens.access)
        localStorage.setItem('refresh', tokens.refresh)
        setIsAuthenticated(true)
    }

    function logout() {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        setIsAuthenticated(false)
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}