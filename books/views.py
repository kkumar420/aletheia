import requests
from django.shortcuts import render
from django.contrib.auth import authenticate
from django.views.decorators.cache import never_cache
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
    search_fields = ['name']


class PublisherViewSet(viewsets.ModelViewSet):
    queryset = Publisher.objects.all()
    serializer_class = PublisherSerializer
    search_fields = ['name']


class BookViewSet(viewsets.ModelViewSet):
    # OPTIMIZATION: prefetch authors and publisher to prevent N+1 queries 
    # when listing books in the global database.
    queryset = Book.objects.select_related('publisher').prefetch_related('authors')
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
    search_fields = ['book__title', 'book__authors__name', 'tags__name']

    def get_queryset(self):
        """
        OPTIMIZATION: The N+1 Query Fix.
        Instead of just filtering, we instruct Django to fetch the related 'book' 
        via SQL JOIN, and prefetch the 'authors' and 'tags' in bulk.
        """
        return Userbook.objects.filter(
            user=self.request.user
        ).select_related(
            'book'
        ).prefetch_related(
            'book__authors', 
            'tags'
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
        # UPDATED: Just accept the full image URL directly from the frontend
        cover_image_url = request.data.get('cover_image', '')
        
        # We can extract these later if we add them to the JS payload, but they aren't strictly required
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

        # 2. Check if the universal Book already exists (falling back to title/author if no ISBN)
        book = None
        if isbn:
            book = Book.objects.filter(isbn=isbn).first()
        elif author:
            book = Book.objects.filter(title=title, authors=author).first()

        # 3. If it doesn't exist, create it globally
        if not book:
            book = Book.objects.create(
                title=title,
                publisher=publisher,
                isbn=isbn or "",
                cover_image=cover_image_url # Use the URL sent from JS
            )
            if author:
                book.authors.add(author)

        # 4. Finally, link the global Book to the specific User
        userbook, created = Userbook.objects.get_or_create(
            user=request.user,
            book=book,
            defaults={'status': 'WANT'} # Default to "Want to Read"
        )

        # Prevent adding the exact same book twice to the user's library
        if not created:
            return Response({"detail": "This book is already in your library!"}, status=400)

        return Response({
            "message": "Book added successfully",
            "book_id": book.id,
            "userbook_id": userbook.id
        }, status=201)
    

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