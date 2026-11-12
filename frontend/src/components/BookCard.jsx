function BookCard({ book }) {
    const statusLabels = {
        WANT: 'Want To Read',
        READ: 'Finished',
        READING: 'Reading',
        DNF: 'Did Not Finish',
    }

    return (
        <div className="book-card">
            <img
                src={book.cover_image || '/images/book-placeholder.png'}
                className="book-cover"
                alt={`Cover of ${book.title}`}
            />

            <div className="book-info">
                <div className="book-title">{book.title}</div>

                <div className="book-author">
                    {book.author || 'Unknown Author'}
                </div>

                <div className="book-status">
                    {statusLabels[book.status] || book.status}
                </div>

                {book.rating && (
                    <div className="book-rating">
                        ⭐ {book.rating}/5
                    </div>
                )}

                <div className="book-tags">
                    {book.tags?.map((tag) => (
                        <span className="tag-chip" key={tag.id}>
                            #{tag.name}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default BookCard