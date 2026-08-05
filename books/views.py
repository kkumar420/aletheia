import requests
from django.core.files.base import ContentFile
from django.shortcuts import render
from django.contrib.auth import authenticate
from django.views.decorators.cache import never_cache
from django.db.models import Value
from django.db.models.functions import Coalesce, NullIf
from rest_framework import viewsets, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Author, Publisher, Book, Userbook, Tag
from .serializers import (
    AuthorSerializer, PublisherSerializer, BookSerializer, 
    UserbookSerializer, RegisterSerializer, BookCreateSerializer, 
    TagSerializer, UserBookDashboardSerializer
)


# ==========================================
# 1. Standard Model ViewSets (CRUD APIs)
# ==========================================

class AuthorViewSet(viewsets.ModelViewSet):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name']


class PublisherViewSet(viewsets.ModelViewSet):
    queryset = Publisher.objects.all()
    serializer_class = PublisherSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name']


class BookViewSet(viewsets.ModelViewSet):
    # OPTIMIZATION: prefetch authors and publisher to prevent N+1 queries 
    # when listing books in the global database.
    queryset = Book.objects.select_related('publisher').prefetch_related('authors')
    permission_classes = [IsAuthenticated]
    search_fields = ['title', 'authors__name']

    def get_serializer_class(self):
        """Dynamically switch serializers based on the HTTP method."""
        if self.action in ['create', 'update', 'partial_update']:
            return BookCreateSerializer
        return BookSerializer


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users should only see and manage their own tags
        return Tag.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        # Automatically attach the logged-in user when creating a new tag
        serializer.save(user=self.request.user)


class UserbookViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    
    # Enable filtering by URL params like ?status=READ
    filterset_fields = ['status', 'tags']
    search_fields = ['effective_title', 'effective_author', 'book__authors__name', 'tags__name']
    ordering = ['-added_at']

    def get_queryset(self):
        """
        Annotates the queryset with effective_title and effective_author
        so sorting and searching respect custom overrides.
        Coalesce(NullIf(custom_field, ''), fallback) treats blank strings
        as NULL so it correctly falls through to the Book-level data.
        """
        return Userbook.objects.filter(
            user=self.request.user
        ).select_related(
            'book'
        ).prefetch_related(
            'book__authors', 
            'tags'
        ).annotate(
            effective_title=Coalesce(
                NullIf('custom_title', Value('')),
                'book__title'
            ),
            effective_author=Coalesce(
                NullIf('custom_author', Value('')),
                'book__authors__name'
            ),
        ).distinct()
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def get_serializer_class(self):
        # Use the lightweight dashboard serializer for list views to speed up load times
        if self.action == 'list':
            return UserBookDashboardSerializer
        return UserbookSerializer


# ==========================================
# 2. Custom API Views (Authentication & External APIs)
# ==========================================

class RegisterView(APIView):
    """Handles new user sign-ups."""
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "User created successfully"}, 
                status=status.HTTP_201_CREATED
            )
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OpenLibrarySearchView(APIView):
    """Acts as a proxy to fetch book data from the external OpenLibrary API."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Accept both generic 'q' and field-specific params for advanced search
        query = request.query_params.get('q', '')
        title = request.query_params.get('title', '')
        author = request.query_params.get('author', '')
        isbn = request.query_params.get('isbn', '')
        language = request.query_params.get('language', '')

        # At least one search parameter must be provided
        if not any([query, title, author, isbn, language]):
            return Response(
                {"error": "A search query must be provided"}, 
                status=400
            )
        
        page_index = request.query_params.get('page', '1')

        url = "https://openlibrary.org/search.json"

        # Build params — forward individual fields when provided
        api_params = {
            "page": page_index,
            "limit": 5,
            "fields": "title,author_name,publisher,language,isbn,cover_i,key"
        }
        if query:    api_params["q"] = query
        if title:    api_params["title"] = title
        if author:   api_params["author"] = author
        if isbn:     api_params["isbn"] = isbn
        if language: api_params["language"] = language

        try:
            response = requests.get(
                url,
                params=api_params,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
        except requests.exceptions.RequestException:
            return Response(
                {"error": "Failed to fetch data from OpenLibrary."}, 
                status=502
            )

        results = []
        for book in data.get("docs", []):
            results.append({
                "title": book.get("title"),
                "author_name": book.get("author_name", [None])[0],
                "publisher": book.get("publisher", [None])[0],
                "isbn": book.get("isbn", [None])[0],
                "cover_i": book.get("cover_i"),
                "key": book.get("key")
            })

        return Response(results)
    

class AddBookView(APIView):
    """
    Handles taking a result from OpenLibrary and saving it to the local database,
    linking it to the current user's library.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        title = request.data.get('title')
        author_name = request.data.get('author')
        cover_image_url = request.data.get('cover_image', '')
        publisher_name = request.data.get('publisher')
        isbn = request.data.get('isbn')

        if not title:
            return Response({"error": "Title required"}, status=400)
        
        author = None
        if author_name:
            author, _ = Author.objects.get_or_create(name=author_name)

        publisher = None
        if publisher_name:
            publisher, _ = Publisher.objects.get_or_create(name=publisher_name)

        # Check if the universal Book already exists
        book = None
        if isbn:
            book = Book.objects.filter(isbn=isbn).first()
        elif author:
            book = Book.objects.filter(title=title, authors=author).first()

        # If it doesn't exist, create it globally
        if not book:
            book = Book.objects.create(
                title=title,
                publisher=publisher,
                isbn=isbn or "",
            )
            if author:
                book.authors.add(author)

            # Download and cache the cover image locally
            if cover_image_url and 'openlibrary.org' in cover_image_url:
                try:
                    img_response = requests.get(cover_image_url, timeout=8)
                    if img_response.status_code == 200:
                        # Generate a safe filename
                        safe_title = title[:30].replace(' ', '_').replace('/', '-')
                        filename = f"cover_{safe_title}.jpg"
                        cover_file = ContentFile(img_response.content, name=filename)
                        book.cover_image.save(filename, cover_file, save=True)
                except requests.RequestException:
                    pass  # Silently fall back to no cover

        # Link the global Book to the specific User
        userbook, created = Userbook.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={'status': 'WANT'}
        )

        if not created:
            return Response({"detail": "This book is already in your library!"}, status=400)

        return Response({
            "message": "Book added successfully",
            "book_id": book.id,
            "userbook_id": userbook.id
        }, status=201)


class ManualAddBookView(APIView):
    """Handles manually adding a book with user-provided metadata."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get('title', '').strip()
        author_name = request.data.get('author', '').strip()
        cover = request.FILES.get('cover')

        if not title:
            return Response({"error": "Title is required"}, status=400)

        # Resolve or create the author first, so we can use them for deduplication
        author_obj = None
        if author_name:
            author_obj, _ = Author.objects.get_or_create(name=author_name)

        # Avoid polluting the global Book table with duplicates.
        # Match on (title, author) the same way AddBookView does.
        book = None
        if author_obj:
            book = Book.objects.filter(title=title, authors=author_obj).first()

        if not book:
            book = Book.objects.create(title=title)
            if author_obj:
                book.authors.add(author_obj)

        # Link the book to the user, or return early if already in their library
        userbook, created = Userbook.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={
                'status': 'WANT',
                'custom_title': title,
                'custom_author': author_name,
            }
        )

        if not created:
            return Response({"detail": "This book is already in your library!"}, status=400)

        if cover:
            userbook.custom_cover.save(cover.name, cover, save=True)

        return Response({
            "message": "Book added manually",
            "userbook_id": str(userbook.id)
        }, status=201)


class BulkDeleteView(APIView):
    """Handles deleting multiple Userbook entries at once."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=400)

        deleted_count, _ = Userbook.objects.filter(
            user=request.user, id__in=ids
        ).delete()

        return Response({"deleted": deleted_count})


# ==========================================
# 3. HTML Template Views (Frontend Routing)
# ==========================================

@never_cache
def dashboard(request):
    return render(request, "books/dashboard.html")

def login_page(request):
    return render(request, "books/login.html")

@never_cache
def book_info_page(request, pk):
    return render(request, "books/book_info.html", {"book_id": pk})

@never_cache
def add_book_page(request):
    return render(request, "books/add_book.html")

@never_cache
def settings_page(request):
    return render(request, "books/settings.html")

def register_page(request):
    return render(request, "books/register.html")