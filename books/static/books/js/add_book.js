// --- Global Pagination State ---
let currentQuery = "";
let currentPage = 1;
const resultsLimit = 6; // Matching an even grid alignment layout better

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
    
    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                // Initial fresh search initialization sequence
                currentQuery = query;
                currentPage = 1; 
                document.getElementById("results-container").innerHTML = ""; 
                performSearch(currentQuery, currentPage);
            }
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            currentPage++; // Step up to next dataset index window
            performSearch(currentQuery, currentPage);
        });
    }

    // Capture explicit author query links arriving from details parameters window
    const urlParams = new URLSearchParams(window.location.search);
    const authorParam = urlParams.get('author');
    if (authorParam && searchInput) {
        searchInput.value = authorParam;
        currentQuery = authorParam;
        currentPage = 1;
        performSearch(currentQuery, currentPage);
    }
});

// --- Paginated Search Logic ---
async function performSearch(query, page) {
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
        loadMoreContainer.style.display = "none"; // Hide button on baseline execution initialization
    }

    try {
        // Forward query string along with page parameter indices down to views endpoint
        const response = await apiFetch(`/api/search-openlibrary/?q=${encodeURIComponent(query)}&page=${page}`);
        
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
            loadMoreContainer.style.display = "none"; // Hide panel entirely if page tail hits terminus boundary limits
            alert("You have reached the end of all available library records.");
        }
        return;
    }

    // Map rows arrays chunks natively 
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
        // APPEND data cards directly to layout grid elements instead of overwriting historical lists
        container.insertAdjacentHTML('beforeend', newCardsHtml);
    }

    // Dynamic visibility assignment evaluation: display only if returned set indicates potential further depths
    if (results.length >= 5) {
        loadMoreContainer.style.display = "block";
    } else {
        loadMoreContainer.style.display = "none";
    }

    // Rebind newly introduced transaction click parameters anchors safely
    container.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.replaceWith(btn.cloneNode(true)); // Avoid event doubling leak traps across paginated append overlays
    });
    
    document.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.addEventListener("click", handleAddBook);
    });
}

// --- Add to Library Logic ---
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
            }, 400); // 400ms delay lets the green checkmark flash satisfyingly first
            
        } else {
            // Check if the server explicitly told us the book is already in the library
            if (data.detail && data.detail.includes("already")) {
                throw new Error("ALREADY_EXISTS");
            }
            throw new Error(data.detail || "Failed to append record target.");
        }
    } catch (error) {
        console.error("Collection addition error event tracking:", error);
        
        if (error.message === "ALREADY_EXISTS") {
            button.textContent = "In Library";
            button.style.background = "#3b82f6"; // Noticeable primary blue
        } else {
            button.textContent = "Error!";
            button.style.background = "var(--danger)";
            
            // Reset button on unexpected layout drops so they can try again
            setTimeout(() => {
                button.textContent = "Add to Library";
                button.disabled = false;
                button.style.background = historicalBackgroundStyle;
            }, 2500);
        }
    }
}