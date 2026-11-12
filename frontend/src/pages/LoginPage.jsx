import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

import api from '../api/client'
import AuthLayout from '../components/AuthLayout'


function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()

        setError('')
        setIsSubmitting(true)

        try {
            const response = await api.post('/token/', {
                username: username.trim(),
                password,
            })

            // Store the JWT tokens.
            login(response.data)

            // Navigate to the React dashboard.
            navigate('/dashboard', { replace: true })

        } catch (error) {
            setError(
                error.response?.data?.detail ||
                'Login failed. Please check your credentials.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthLayout
            tagline="Organize what shapes your understanding"
            footerText="Don't have an account?"
            footerLinkText="Create one"
            footerLinkTo="/register"
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="username">Username</label>

                    <input
                        type="text"
                        id="username"
                        className="input"
                        placeholder="Enter username"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>

                    <input
                        type="password"
                        id="password"
                        className="input"
                        placeholder="Enter password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>

                <div
                    className="error-message"
                    role="alert"
                    style={{ display: error ? 'block' : 'none' }}
                >
                    {error}
                </div>
            </form>
        </AuthLayout>
    )
}

export default LoginPage