from django.db import models
from django.contrib.auth.models import User
import uuid


class Author(models.Model):
    """
    Universal model representing a book's author.
    Kept separate from the Book model to allow multiple books 
    to reference the same author without data duplication.
    """
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name    


class Publisher(models.Model):
    """
    Universal model representing a publishing house.
    """
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Tag(models.Model):
    """
    User-specific categorization tags (e.g., 'philosophy', 'favorites').
    """
    name = models.CharField(max_length=100)
    
    # Links the tag to a specific user. 
    # 'related_name="tags"' allows us to query user.tags.all()
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tags"
    )

    class Meta:
        # Ensures a user cannot create multiple tags with the exact same name
        unique_together = ('user', 'name')

    def __str__(self):
        return self.name


class Book(models.Model):
    """
    Universal Book model holding global metadata.
    This data is shared across all users who have this book in their library.
    """
    title = models.CharField(max_length=255)
    
    # A book can have multiple authors, and an author can write multiple books.
    authors = models.ManyToManyField(Author)

    # If a publisher is deleted from the database, the book remains, 
    # but this field is set to NULL (on_delete=models.SET_NULL).
    publisher = models.ForeignKey(
        Publisher,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Metadata fetched from OpenLibrary
    description = models.TextField(blank=True)
    language = models.CharField(max_length=50, blank=True)
    isbn = models.CharField(max_length=20, blank=True)
    
    # We store the image URL from OpenLibrary rather than hosting the file locally
    cover_image = models.URLField(blank=True)

    def __str__(self):
        return self.title


class Userbook(models.Model):
    """
    The personal library model. 
    This acts as a mapping table connecting a specific User to a specific Book,
    holding data that is entirely subjective/personal to that user.
    """
    # Define available statuses for the dropdown UI
    STATUS_CHOICES = [
        ("READ", "Read"),
        ("READING", "Reading"),
        ("WANT", "Want"),
        ("DNF", "NotFinish")
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # --- Relational Dependencies ---
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    book = models.ForeignKey(Book, on_delete=models.CASCADE)

    # --- Personal Reading Data ---
    status = models.CharField(
        max_length=10, 
        choices=STATUS_CHOICES, 
        default="WANT"
    )
    rating = models.DecimalField(
        max_digits=2, 
        decimal_places=1, 
        null=True, 
        blank=True
    )
    notes = models.TextField(blank=True)

    # --- Timeline Tracking ---
    # auto_now_add automatically stamps the exact time the record is created
    added_at = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField(null=True, blank=True)
    finish_date = models.DateField(null=True, blank=True)

    # --- File Management & Organization ---
    # Django will automatically save uploaded files to a /media/ebooks/ directory
    ebook_file = models.FileField(
        upload_to="ebooks/",
        null=True,
        blank=True,
    )
    
    # Users can attach their personal tags to this specific book mapping
    tags = models.ManyToManyField(Tag, blank=True)

    class Meta:
        # A user can only have a specific book in their library once
        unique_together = ('user', 'book')

    def __str__(self):
        return f"{self.user.username} - {self.book.title}"