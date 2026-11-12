import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth()

    return isAuthenticated
        ? children
        : <Navigate to="/login" replace />
}

export function GuestRoute({ children }) {
    const { isAuthenticated } = useAuth()

    return isAuthenticated
        ? <Navigate to="/dashboard" replace />
        : children
}