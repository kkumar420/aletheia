// --- Global State ---
let currentSearchParams = "";
let currentPage = 1;
let isAdvancedMode = false;
let isManualMode = false;
const resultsLimit = 6;

// --- API Interceptor ---
async function apiFetch(url, options = {}) {
    let token = localStorage.getItem("access");
    options.headers = { ...options.headers, "Authorization": `Bearer ${token}` };
    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) { window.location.replace("/login-page/"); return response; }
        const refreshResponse = await fetch("/token/refresh/", {
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
            window.location.replace("/login-page/");
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
    
    // Mode switching
    const modeSearchBtn = document.getElementById("mode-search-btn");
    const modeManualBtn = document.getElementById("mode-manual-btn");
    const searchContent = document.getElementById("search-mode-content");
    const manualContent = document.getElementById("manual-mode-content");

    if (modeSearchBtn && modeManualBtn) {
        modeSearchBtn.addEventListener("click", () => {
            isManualMode = false;
            modeSearchBtn.classList.add("is-active");
            modeManualBtn.classList.remove("is-active");
            searchContent.style.display = "";
            manualContent.style.display = "none";
            document.getElementById("results-container").style.display = "";
            document.getElementById("loading-spinner").style.display = "none";
            document.getElementById("load-more-container").style.display = "none";
        });

        modeManualBtn.addEventListener("click", () => {
            isManualMode = true;
            modeManualBtn.classList.add("is-active");
            modeSearchBtn.classList.remove("is-active");
            searchContent.style.display = "none";
            manualContent.style.display = "";
            document.getElementById("results-container").style.display = "none";
            document.getElementById("loading-spinner").style.display = "none";
            document.getElementById("load-more-container").style.display = "none";
        });
    }

    // Manual cover upload preview
    const manualCoverBtn = document.getElementById("manual-cover-btn");
    const manualCoverInput = document.getElementById("manual-cover-input");
    if (manualCoverBtn && manualCoverInput) {
        manualCoverBtn.addEventListener("click", () => manualCoverInput.click());
        manualCoverInput.addEventListener("change", () => {
            const file = manualCoverInput.files[0];
            if (file) {
                const preview = document.getElementById("manual-cover-preview");
                preview.src = URL.createObjectURL(file);
                preview.classList.add("has-image");
            }
        });
    }

    // Manual form submission
    const manualForm = document.getElementById("manual-form");
    if (manualForm) {
        manualForm.addEventListener("submit", handleManualAdd);
    }

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

    // Search clear button & Escape key listener
    const searchClearBtn = document.getElementById("search-clear-btn");
    if (searchClearBtn && searchInput) {
        
        // 1. Show/hide 'X' button on type
        searchInput.addEventListener("input", () => {
            searchClearBtn.classList.toggle("is-visible", searchInput.value.length > 0);
        });

        // 2. The clear function (reusable)
        const clearSearch = () => {
            if (searchInput.value.length > 0 || document.getElementById("results-container").innerHTML !== "") {
                searchInput.value = "";
                searchClearBtn.classList.remove("is-visible");
                document.getElementById("results-container").innerHTML = "";
                document.getElementById("load-more-container").style.display = "none";
                searchInput.blur(); // Un-focus the search bar
            }
        };

        // 3. Click listener for the 'X' button
        searchClearBtn.addEventListener("click", clearSearch);

        // 4. Escape key listener
        document.addEventListener("keydown", (e) => {
            // Check if the key pressed is Escape, and that we are currently in "Search Online" mode
            if (e.key === "Escape" && !isManualMode) {
                clearSearch();
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
                if (!params) return;
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

    // Capture author query from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const authorParam = urlParams.get('author');
    if (authorParam && searchInput) {
        searchInput.value = authorParam;
        currentSearchParams = `q=${encodeURIComponent(authorParam)}`;
        currentPage = 1;
        performSearch(currentSearchParams, currentPage);
    }
});

// --- Manual Add Handler ---
async function handleManualAdd(e) {
    e.preventDefault();

    const title = document.getElementById("manual-title").value.trim();
    const author = document.getElementById("manual-author").value.trim();
    const coverFile = document.getElementById("manual-cover-input").files[0];

    if (!title) return;

    const submitBtn = document.getElementById("manual-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";

    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    if (coverFile) formData.append("cover", coverFile);

    try {
        const token = localStorage.getItem("access");
        const response = await fetch("/manual-add-book/", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            submitBtn.textContent = "Added ✓";
            setTimeout(() => {
                window.location.href = `/book/${data.userbook_id}/`;
            }, 400);
        } else {
            throw new Error(data.error || "Failed to add book");
        }
    } catch (error) {
        console.error("Manual add error:", error);
        submitBtn.textContent = "Error!";
        setTimeout(() => {
            submitBtn.textContent = "Add to Library";
            submitBtn.disabled = false;
        }, 2000);
    }
}

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
    
    spinner.style.display = "block";
    searchBtn.disabled = true;
    if (page > 1) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading More...";
    } else {
        loadMoreContainer.style.display = "none";
    }

    try {
        const response = await apiFetch(`/search-openlibrary/?${searchParams}&page=${page}`);
        if (!response.ok) throw new Error("Search proxy returned error status.");
        const data = await response.json();
        renderResults(data, page);
    } catch (error) {
        console.error("Search error:", error);
        if (page === 1) {
            container.innerHTML = `<p class="text-secondary" style="grid-column: 1 / -1; text-align: center; color: var(--danger);">Connection lost. Please try again.</p>`;
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
            container.innerHTML = `<p class="text-secondary" style="grid-column: 1 / -1; text-align: center;">No matching entries found.</p>`;
        } else {
            loadMoreContainer.style.display = "none";
        }
        return;
    }

    const newCardsHtml = results.map(book => {
        const title = book.title || "Unknown Title";
        const author = book.author_name ? (Array.isArray(book.author_name) ? book.author_name[0] : book.author_name) : "Unknown Author";
        
        // The backend's search view already extracts the first element of the arrays, 
        // so these are already strings.
        const primaryIsbn = book.isbn || null;
        const primaryPublisher = book.publisher || null;

        // Priority requested: ISBN (lookup by ISBN) → cover_i (direct ID) → local placeholder.
        const isbnUrl = primaryIsbn ? `https://covers.openlibrary.org/b/isbn/${primaryIsbn}-M.jpg?default=false` : "";
        const coverIdUrl = book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : "";
        const placeholderUrl = "/static/books/images/book-placeholder.png";

        const initialSrc = isbnUrl || coverIdUrl || placeholderUrl;
        
        // Build the onerror chain. If the first image fails, we want to try the next one,
        // and finally the placeholder.
        let onErrorChain = `this.onerror=null; this.src='${placeholderUrl}';`;
        if (isbnUrl && coverIdUrl) {
            // When isbnUrl fails, set fallback onerror to placeholder, then switch src to coverIdUrl
            onErrorChain = `this.onerror=function(){ this.onerror=null; this.src='${placeholderUrl}'; }; this.src='${coverIdUrl}';`;
        }

        const bookDataString = encodeURIComponent(JSON.stringify({
            title: title,
            author: author,
            cover_i: book.cover_i || "",
            isbn: primaryIsbn || "",
            publisher: primaryPublisher || ""
        }));

        return `
            <div class="book-card flex" style="flex-direction: column;">
                <img src="${initialSrc}" class="book-cover" alt="Cover" style="margin-bottom: 15px;"
                     onerror="${onErrorChain}">
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

    container.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll(".add-to-lib-btn").forEach(btn => {
        btn.addEventListener("click", handleAddBook);
    });
}

// --- Add to Library Logic ---
async function handleAddBook(e) {
    const button = e.target;
    const bookData = JSON.parse(decodeURIComponent(button.getAttribute("data-book")));

    button.textContent = "Adding...";
    button.disabled = true;
    const historicalBg = button.style.background;
    button.style.background = "#64748b";

    try {
        const response = await apiFetch(`/add-book/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bookData)
        });

        const data = await response.json();

        if (response.ok) {
            button.textContent = "Added ✓";
            button.style.background = "#10b981";
            setTimeout(() => {
                window.location.href = `/book/${data.userbook_id}/`;
            }, 400);
        } else {
            if (data.detail && data.detail.includes("already")) {
                throw new Error("ALREADY_EXISTS");
            }
            throw new Error(data.detail || "Failed to add.");
        }
    } catch (error) {
        console.error("Add error:", error);
        if (error.message === "ALREADY_EXISTS") {
            button.textContent = "In Library";
            button.style.background = "#3b82f6";
        } else {
            button.textContent = "Error!";
            button.style.background = "var(--danger)";
            setTimeout(() => {
                button.textContent = "Add to Library";
                button.disabled = false;
                button.style.background = historicalBg;
            }, 2500);
        }
    }
}