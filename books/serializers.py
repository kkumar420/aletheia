from rest_framework import serializers
from .models import Author, Publisher, Book, Userbook, Tag
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password

class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = '__all__'

class PublisherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Publisher
        fields = '__all__'

class BookSerializer(serializers.ModelSerializer):
    authors = AuthorSerializer(many=True, read_only=True)
    publisher = PublisherSerializer(read_only=True)
    class Meta:
        model = Book
        fields = '__all__'

class BookCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = '__all__'

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = [
            'id',
            'name'
        ]

class UserbookSerializer(serializers.ModelSerializer):
    book_title = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    
    # A temporary portal just for receiving data from the frontend
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=100),
        write_only=True,
        required=False
    )

    class Meta:
        model = Userbook
        fields = [
            'id', 'book', 'book_title', 'author', 'cover_image', 
            'status', 'rating', 'tags', 'tag_names',
            'ebook_file', 'added_at', 'start_date', 'finish_date', 'notes',
            'custom_title', 'custom_author', 'custom_cover',
        ]
        read_only_fields = ['user']
    
    def get_book_title(self, obj):
        return obj.custom_title or obj.book.title

    def get_author(self, obj):
        if obj.custom_author:
            return obj.custom_author
        author = obj.book.authors.first()
        return author.name if author else ""

    def get_cover_image(self, obj):
        request = self.context.get('request')
        if obj.custom_cover:
            return request.build_absolute_uri(obj.custom_cover.url) if request else obj.custom_cover.url
        if obj.book.cover_image:
            cover_str = str(obj.book.cover_image)
            if cover_str.startswith('http'):
                return cover_str
            return request.build_absolute_uri(obj.book.cover_image.url) if request else obj.book.cover_image.url
        return ""

    # Override the save behavior to intercept the tags
    def update(self, instance, validated_data):
        # 1. Pop the tags out of the data dictionary before Django tries to save them
        tag_names = validated_data.pop('tag_names', None)
        
        # 2. Let Django run its normal update for status, notes, dates, etc.
        instance = super().update(instance, validated_data)

        # 3. Handle the Many-to-Many Tag logic manually
        if tag_names is not None:
            user = self.context['request'].user
            tag_objs = []
            
            for name in tag_names:
                # Clean the input to prevent duplicates like "Fiction" and "fiction "
                clean_name = name.strip().lower()
                if clean_name:
                    # get_or_create ensures we don't duplicate tags in the database
                    tag, _ = Tag.objects.get_or_create(user=user, name=clean_name)
                    tag_objs.append(tag)
            
            # .set() completely replaces the old list of tags with this new list
            instance.tags.set(tag_objs)

        return instance
    
class UserBookDashboardSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Userbook
        fields = [
            'id',
            'title',
            'cover_image',
            'author',
            'status',
            'rating',
            'tags',
            'added_at',
            'start_date',
            'finish_date',
        ]

    def get_title(self, obj):
        return obj.custom_title or obj.book.title

    def get_author(self, obj):
        if obj.custom_author:
            return obj.custom_author
        author = obj.book.authors.first()
        return author.name if author else ""

    def get_cover_image(self, obj):
        request = self.context.get('request')
        if obj.custom_cover:
            return request.build_absolute_uri(obj.custom_cover.url) if request else obj.custom_cover.url
        if obj.book.cover_image:
            cover_str = str(obj.book.cover_image)
            if cover_str.startswith('http'):
                return cover_str
            return request.build_absolute_uri(obj.book.cover_image.url) if request else obj.book.cover_image.url
        return ""

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only = True,
        required = True,
        validators = [validate_password]
    )

    email = serializers.EmailField(
        required = False,
        allow_blank = True
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'password']


    def create(self, validated_data):
        user = User.objects.create_user(
            username = validated_data['username'],
            email = validated_data.get('email', ''),
            password = validated_data['password']
        )
        return user