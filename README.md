# Aletheia

*Aletheia* (ἀλήθεια) is the ancient Greek concept of truth—literally translated as "unconcealedness" or the state of not being hidden. Literature serves as a primary mechanism for this disclosure, acting not merely as entertainment, but as a mirror for psychological complexity and rigorous self-inquiry. 

However, the acquisition of knowledge demands structure; an unorganized library reflects a fractured intellect. Aletheia was built to impose order on intellectual exploration, providing a quiet, dedicated digital space to track, organize, and synthesize the texts that shape our understanding.

---

## 🏗️ System Architecture & Technology Stack

Aletheia is engineered with a deliberate focus on performance and architectural clarity. It eschews heavy, sprawling frontend frameworks in favor of a lean, highly responsive stack that places control firmly in the hands of the developer.

### Backend Infrastructure
- **Django 6.0 & Python 3.14:** Operating on the bleeding edge of Python web development, providing a robust, highly secure, and exceptionally scalable foundation.
- **Django REST Framework (DRF):** Transforms the backend into a stateless API architecture, strictly separating the data layer from the presentation layer.
- **PostgreSQL:** The primary relational database engine, chosen for its ACID compliance and handling of complex relational metadata mapping (User-to-Book relationships).
- **SimpleJWT:** Manages stateless, token-based authentication (Access/Refresh rotation) to ensure high security without the overhead of server-side session querying.

### Frontend Presentation
- **Vanilla JavaScript:** Powers the entire application state. All API interactions, DOM manipulations, and asynchronous data fetching are written in pure JS to eliminate dependency bloat.
- **Native CSS (Glassmorphism & Variables):** A completely custom-built design system utilizing deep CSS variables for a seamless, dynamic Light/Dark mode toggle, avoiding the utility-class clutter of frameworks like Tailwind.
- **Django HTML Templates:** Used strictly for foundational routing and delivering the base DOM structure before the Vanilla JS payload takes over rendering.

### Asset Management & Delivery
- **Cloudinary Storage Integration:** Replaces ephemeral local media storage with permanent cloud hosting. Cover images and user-uploaded ebooks are securely routed directly to Cloudinary via Django's storage backends.
- **WhiteNoise Middleware:** Intercepts and serves static files (CSS/JS) directly through the WSGI application with Brotli compression, optimizing asset delivery without requiring a dedicated Nginx configuration.

---

## ✨ Comprehensive Feature Matrix

Aletheia provides a deeply integrated suite of tools designed to curate and manipulate literary data effectively.

### 1. Intelligent Data Ingestion
- **OpenLibrary API Integration:** A custom-built proxy endpoint securely fetches global book metadata (Title, Author, Publisher, ISBN, and Cover Art) directly from OpenLibrary, preventing CORS issues.
- **Automated Cover Extraction:** The backend actively downloads external cover URLs using the `requests` library and saves them directly to Cloudinary via Django's `ContentFile`, ensuring the system isn't reliant on external hotlinks breaking over time.
- **Manual Title Entry:** Bypasses the API entirely, allowing users to catalog obscure texts, self-published works, or academic papers with custom metadata and uploaded cover images.

### 2. The Override Architecture
- **Global Data vs. Subjective Reality:** Aletheia utilizes a `Userbook` mapping model to connect a specific user to a global `Book` entity.
- **Personalized Editing:** Users can override the global metadata with their own `custom_title`, `custom_author`, and `custom_cover` fields. This ensures absolute personalization without polluting the global database for other users.

### 3. State-Preserving Dashboard
- **Algorithmic Layouts:** The interface dynamically renders results in either a highly visual Cover Grid or an analytical List View.
- **`localStorage` Persistence:** View types, sort properties (Date Added, Rating, Start Date, Title), and sort directions are instantly cached to the browser. Navigating away and returning to the dashboard instantly restores the exact visual state without any loading flicker.

### 4. Advanced Categorization & State Tracking
- **Reading Status Engine:** Tracks a book's life cycle through strict statuses: *Want to Read*, *Reading*, *Finished*, and *Did Not Finish (DNF)*. Users can dynamically toggle and filter multiple statuses concurrently (e.g. view both 'Reading' and 'Want to Read' simultaneously).
- **Custom Tagging Topology:** Users can generate infinite custom tags to map thematic connections between texts.
- **Additive Filtering:** Selecting a tag on a book card dynamically injects it into an active filter Set, allowing users to drill down into their library using a combination of text-search, multi-status, and multi-tag parameters instantly on the client side.

### 5. Utility & Library Management
- **Bulk Action Capabilities:** Checkbox-driven DOM nodes allow users to select multiple books simultaneously and issue a singular bulk-delete payload to the REST API, minimizing network requests.
- **Ebook Archival:** Features a dedicated file upload stream allowing users to permanently attach `.epub` or `.pdf` files to their personal records for localized reading access.
- **Dark/Light Thematic Toggling:** Modifies the overarching CSS variable scope instantaneously to shift the glassmorphism UI to accommodate environmental lighting preferences.
