// --- Global Pagination State ---
let currentSearchParams = "";
let currentPage = 1;
let isAdvancedMode = false;
const resultsLimit = 6;

// --- API Interceptor ---
async function apiFetch(url, options = {}) {
    let token = localStorage.getItem("access");
    options.headers = { ...options.headers, "Authorization": `Bearer ${token}` };
    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) { window.location.replace("/api/login-page/"); return response; }
        const refreshResponse = await fetch("/api/token/refresh/", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken })
        });
        if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem("access", data.access);
            options.headers["Authorization"] = `Bearer ${data.access}`;
            response = await fetch(url, options);
        } else {
            localStorage.removeItem("access"); localStorage.removeItem("refresh");
            window.location.replace("/api/login-page/");
        }
    }
    return response;
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    const searchForm = document.getElementById("search-form");
    const searchInput = document.getElementById("search-input");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const advancedToggle = document.getElementById("advanced-toggle");
    const advancedPanel = document.getElementById("advanced-panel");
    
    // Advanced search toggle
    if (advancedToggle && advancedPanel) {
        advancedToggle.addEventListener("click", () => {
            isAdvancedMode = !isAdvancedMode;
            advancedPanel.classList.toggle("is-open", isAdvancedMode);
            advancedToggle.classList.toggle("is-active", isAdvancedMode);

            if (isAdvancedMode) {
                searchInput.placeholder = "General search (optional)...";
                searchInput.removeAttribute("required");
            } else {
                searchInput.placeholder = "Search by title, author, or ISBN...";
                searchInput.setAttribute("required", "");
            }
        });
    }

    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            currentPage = 1;
            document.getElementById("results-container").innerHTML = "";

            if (isAdvancedMode) {
                const params = buildAdvancedParams();
                if (!params) return; // Nothing to search
                currentSearchParams = params;
            } else {
                const query = searchInput.value.trim();
                if (!query) return;
                currentSearchParams = `q=${encodeURIComponent(query)}`;
            }

            performSearch(currentSearchParams, currentPage);
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            currentPage++;
            performSearch(currentSearchParams, currentPage);
        });
    }

    // Capture explicit author query links arriving from details parameters window
    const urlParams = new URLSearchParams(window.location.search);
    const authorParam = urlParams.get('author');
    if (authorParam && searchInput) {
        searchInput.value = authorParam;
        currentSearchParams = `q=${encodeURIComponent(authorParam)}`;
        currentPage = 1;
        performSearch(currentSearchParams, currentPage);
    }
});

// --- Build Advanced Search Params ---
function buildAdvancedParams() {
    const params = new URLSearchParams();
    const title = document.getElementById("adv-title")?.value.trim();
    const author = document.getElementById("adv-author")?.value.trim();
    const isbn = document.getElementById("adv-isbn")?.value.trim();
    const language = document.getElementById("adv-language")?.value;
    const general = document.getElementById("search-input")?.value.trim();

    if (general) params.set("q", general);
    if (title) params.set("title", title);
    if (author) params.set("author", author);
    if (isbn) params.set("isbn", isbn);
    if (language) params.set("language", language);

    const result = params.toString();
    return result || null;
}

// --- Paginated Search Logic ---
async function performSearch(searchParams, page) {
    const container = document.getElementById("results-container");
    const spinner = document.getElementById("loading-spinner");
    const searchBtn = document.getElementById("search-btn");
    const loadMoreContainer = document.getElementById("load-more-container");
    const loadMoreBtn = document.getElementById("load-more-btn");
    
    // UI Loading Configurations
    spinner.style.display = "block";
    searchBtn.disabled = true;
    if (page > 1) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading More...";
    } else {
        loadMoreContainer.style.display = "none";
    }

    try {
        const response = await apiFetch(`/api/search-openlibrary/?${searchParams}&page=${page}`);
        
        if (!response.ok) throw new Error("Search proxy returned error status.");
        
        const data = await response.json();
        renderResults(data, page);
        
    } catch (error) {
        console.error("Search error:", error);
        if (page === 1) {
            container.innerHTML = `<p class="text-secondary" style="grid-column: 1 / -1; text-align: center; color: var(--danger);">Connection lost. OpenLibrary may be transiently busy. Please try again.</p>`;
        } else {
            alert("Could not load additional results at this moment.");
        }
    } finally {
        spinner.style.display = "none";
        searchBtn.disabled = false;
        if (loadMoreBtn) {
            loadMoreBtn.disabled = false;
            loadMoreBtn.textContent = "Load More Results";
        }
    }
}

// --- Render Logic ---
function renderResults(results, page) {
    const container = document.getElementById("results-container");
    const loadMoreContainer = document.getElementById("load-more-container");
    
    if (!results || results.length === 0) {
        if (page === 1) {
            container.innerHTML = `<p class="text-secondary" style="grid-column: 1 / -1; text-align: center;">No matching entries found inside public archives.</p>`;
        } else {
            loadMoreContainer.style.display = "none";
            alert("You have reached the end of all available library records.");
        }
        return;
    }

    const newCardsHtml = results.map(book => {
        const title = book.title || "Unknown Title";
        const author = book.author_name || "Unknown Author";
        
        const coverImage = book.cover_i 
            ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` 
            : "/static/books/images/book-placeholder.png";

        const bookDataString = encodeURIComponent(JSON.stringify({
            title: title,
            author: author,
            cover_image: coverImage,
            openlibrary_key: book.key
        }));

        return `
            <div class="book-card flex" style="flex-direction: column;">
                <img src="${coverImage}" class="book-cover" alt="Cover" style="margin-bottom: 15px;">
                <div class="book-info" style="flex: 1; display: flex; flex-direction: column;">
                    <div class="book-title mb-sm">${title}</div>
                    <div class="book-author mb-md">${author}</div>
                    
                    <button class="btn btn-primary add-to-lib-btn" style="margin-top: auto; width: 100%; padding: 0.6rem;" data-book="${bookDataString}">
                        Add to Library
                    </button>
                </div>
            </div>
        `;
    }).join("");

    if (page === 1) {
        container.innerHTML = newCardsHtml;
    } else {
        container.insertAdjacentHTML('beforeend', newCardsHtml);
    }

    if (results.length >= 5) {
        loadMoreContainer.style.display = "block";
    } else {
        loadMoreContainer.style.display = "none";
    }

    // Rebind newly introduced transaction click parameters anchors safely
    container.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.addEventListener("click", handleAddBook);
    });
}

// --- Add to Library Logic & Instant Redirect ---
async function handleAddBook(e) {
    const button = e.target;
    const bookData = JSON.parse(decodeURIComponent(button.getAttribute("data-book")));

    // Visual feedback
    button.textContent = "Adding...";
    button.disabled = true;
    const historicalBackgroundStyle = button.style.background;
    button.style.background = "#64748b";

    try {
        const response = await apiFetch(`/api/add-book/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookData)
        });

        const data = await response.json();

        if (response.ok) {
            button.textContent = "Added ✓";
            button.style.background = "#10b981";
            
            // Seamless Redirect: Use the userbook_id returned by Django to route instantly
            setTimeout(() => {
                window.location.href = `/api/book/${data.userbook_id}/`;
            }, 400);
            
        } else {
            if (data.detail && data.detail.includes("already")) {
                throw new Error("ALREADY_EXISTS");
            }
            throw new Error(data.detail || "Failed to append record target.");
        }
    } catch (error) {
        console.error("Collection addition error event tracking:", error);
        
        if (error.message === "ALREADY_EXISTS") {
            button.textContent = "In Library";
            button.style.background = "#3b82f6";
        } else {
            button.textContent = "Error!";
            button.style.background = "var(--danger)";
            
            setTimeout(() => {
                button.textContent = "Add to Library";
                button.disabled = false;
                button.style.background = historicalBackgroundStyle;
            }, 2500);
        }
    }
}