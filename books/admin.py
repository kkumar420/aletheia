from django.contrib import admin
from .models import Author, Publisher, Book, Userbook, Tag

# Register your models here.
admin.site.register(Author)
admin.site.register(Publisher)
admin.site.register(Book)
admin.site.register(Userbook)
admin.site.register(Tag)