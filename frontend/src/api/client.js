import axios from 'axios'

const api = axios.create({
    baseURL: '/backend',
})

// Separate Axios instance for refreshing tokens.
// This prevents refresh requests from triggering our interceptors.
const refreshApi = axios.create({
    baseURL: '/backend',
})

// Attach the access token to outgoing requests.
api.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('access')

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }

    return config
})

// Used to prevent multiple simultaneous refresh requests.
let refreshPromise = null

function clearSession() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')

    if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
    ) {
        window.location.assign('/login')
    }
}

// Handle failed API responses.
api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const originalRequest = error.config

        // Only handle 401 responses.
        if (error.response?.status !== 401 || !originalRequest) {
            return Promise.reject(error)
        }

        // Don't try refreshing when login or registration itself fails.
        const isAuthEndpoint =
            originalRequest.url?.includes('/token/') ||
            originalRequest.url?.includes('/register/')

        if (isAuthEndpoint) {
            return Promise.reject(error)
        }

        // Don't retry the same request indefinitely.
        if (originalRequest._retry) {
            clearSession()
            return Promise.reject(error)
        }

        const refreshToken = localStorage.getItem('refresh')

        if (!refreshToken) {
            clearSession()
            return Promise.reject(error)
        }

        originalRequest._retry = true

        try {
            // Reuse an ongoing refresh request if one already exists.
            if (!refreshPromise) {
                refreshPromise = refreshApi
                    .post('/token/refresh/', {
                        refresh: refreshToken,
                    })
                    .then(({ data }) => {
                        localStorage.setItem('access', data.access)

                        // SimpleJWT may return a rotated refresh token.
                        if (data.refresh) {
                            localStorage.setItem('refresh', data.refresh)
                        }

                        return data.access
                    })
                    .catch((refreshError) => {
                        clearSession()
                        throw refreshError
                    })
                    .finally(() => {
                        refreshPromise = null
                    })
            }

            const newAccessToken = await refreshPromise

            // Update the original request with the new token.
            originalRequest.headers.Authorization =
                `Bearer ${newAccessToken}`

            // Retry the original request.
            return api(originalRequest)

        } catch (refreshError) {
            return Promise.reject(refreshError)
        }
    }
)

export default api