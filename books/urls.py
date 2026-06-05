from rest_framework.routers import DefaultRouter
from .views import AuthorViewSet, PublisherViewSet, BookViewSet, UserbookViewSet, RegisterView, OpenLibrarySearchView, AddBookView, ManualAddBookView, BulkDeleteView, TagViewSet, login_page, dashboard, book_info_page, add_book_page, settings_page, register_page
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()

router.register(r'authors', AuthorViewSet)
router.register(r'publishers', PublisherViewSet)
router.register(r'books', BookViewSet)
router.register(r'userbooks', UserbookViewSet, basename='userbooks')
router.register(r'tags', TagViewSet, basename='tags')

urlpatterns = [
    path('register/', RegisterView.as_view()),
    # path('login/', LoginView.as_view()),
    # path('logout/', LogoutView.as_view()),
    path('search-openlibrary/', OpenLibrarySearchView.as_view()),
    path('add-book/', AddBookView.as_view()),
    path('', dashboard, name='dashboard'),
    path('login-page/', login_page, name='login_page'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name = 'token_refresh'),
    path('book/<uuid:pk>/', book_info_page, name='book_info_page'),
    path('add-book-page/', add_book_page, name='add_book_page'),
    path('settings-page/', settings_page, name='settings_page'),
    path('manual-add-book/', ManualAddBookView.as_view()),
    path('userbooks/bulk-delete/', BulkDeleteView.as_view()),
    path('register-page/', register_page, name='register_page'),
]

urlpatterns += router.urls