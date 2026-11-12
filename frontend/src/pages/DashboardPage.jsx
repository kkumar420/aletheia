import { useEffect, useState } from 'react'
import api from '../api/client'
import BookCard from '../components/BookCard'

function DashboardPage() {
    const [books, setBooks] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadBooks() {
            try {
                const response = await api.get('/userbooks/')

                if (!cancelled) {
                    setBooks(response.data)
                }
            } catch (error) {
                if (!cancelled) {
                    setError(
                        error.response?.data?.detail ||
                        'Failed to load your library. Please try again.'
                    )
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        loadBooks()

        return () => {
            cancelled = true
        }
    }, [])

    return (
        <div className="dashboard">
            <main className="dashboard__main">
                <h1>My Library</h1>

                {isLoading && <p>Loading your library...</p>}

                {error && <p role="alert">{error}</p>}

                {!isLoading && !error && books.length === 0 && (
                    <p className="text-secondary">
                        Your library is empty. Start by adding a book!
                    </p>
                )}

                {!isLoading && !error && books.length > 0 && (
                    <div className="books-grid">
                        {books.map((book) => (
                            <BookCard key={book.id} book={book} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

export default DashboardPage