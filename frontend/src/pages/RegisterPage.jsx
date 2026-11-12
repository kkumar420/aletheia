import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../context/AuthContext'

import api from '../api/client'
import AuthLayout from '../components/AuthLayout'

// Convert Django REST Framework validation errors into readable text.
function formatDRFErrors(errorData) {
    if (typeof errorData === 'string') {
        return errorData
    }

    const messages = []

    for (const [field, errors] of Object.entries(errorData || {})) {
        const label = field.charAt(0).toUpperCase() + field.slice(1)

        if (Array.isArray(errors)) {
            errors.forEach(message => {
                messages.push(`${label}: ${message}`)
            })
        } else if (typeof errors === 'string') {
            messages.push(errors)
        }
    }

    return messages.join(' ') || 'Registration failed. Please try again.'
}

function RegisterPage() {
    const { login } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')

        // Client-side validation.
        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.')
            return
        }

        setIsSubmitting(true)

        try {
            // 1. Create the account.
            await api.post('/register/', {
                username: username.trim(),
                email: email.trim(),
                password,
            })

            // 2. Automatically log in the newly registered user.
            let tokenResponse

            try {
                tokenResponse = await api.post('/token/', {
                    username: username.trim(),
                    password,
                })
            } catch {
                // Account exists, but automatic login failed.
                navigate('/login', { replace: true })
                return
            }

            login(tokenResponse.data)

            navigate('/dashboard', { replace: true })

        } catch (error) {
            console.error('Registration error:', error)

            setError(
                formatDRFErrors(
                    error.response?.data || {}
                )
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthLayout
            tagline="Begin building your personal library"
            footerText="Already have an account?"
            footerLinkText="Log in"
            footerLinkTo="/login"
        >
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="reg-username">Username</label>

                    <input
                        type="text"
                        id="reg-username"
                        className="input"
                        placeholder="Choose a username"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="reg-email">
                        Email <span className="text-secondary text-sm">(optional)</span>
                    </label>

                    <input
                        type="email"
                        id="reg-email"
                        className="input"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="reg-password">Password</label>

                    <input
                        type="password"
                        id="reg-password"
                        className="input"
                        placeholder="Create a password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="reg-confirm">Confirm Password</label>

                    <input
                        type="password"
                        id="reg-confirm"
                        className="input"
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Creating account...' : 'Create Account'}
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

export default RegisterPage