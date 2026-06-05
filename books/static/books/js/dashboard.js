// --- Global Filter/Sorting States ---
let allBooksData = [];        // Cache master copy of personal records
let selectedStatus = "ALL";   // Track active tab category link
let selectedTags = new Set(); // Track multiple active tag filters simultaneously
let currentView = "grid";
let searchQuery = "";
let sortProperty = "date_added";
let sortDirection = "desc";

// --- API Fetch Wrapper ---
async function apiFetch(url, options = {}) {
    let token = localStorage.getItem("access");
    options.headers = { ...options.headers, "Authorization": `Bearer ${token}` };

    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) {
            window.location.replace("/api/login-page/");
            return response;
        }

        const refreshResponse = await fetch("/api/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken })
        });

        if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem("access", data.access);
            options.headers["Authorization"] = `Bearer ${data.access}`;
            response = await fetch(url, options);
        } else {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            window.location.replace("/api/login-page/");
        }
    }
    return response;
}

// --- Initialization Block ---
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("access");
    if (!token) { window.location.replace("/api/login-page/"); return; }

    // Layout view toggles
    document.getElementById("grid-view-btn").addEventListener("click", () => switchView("grid"));
    document.getElementById("list-view-btn").addEventListener("click", () => switchView("list"));
    
    document.getElementById("settings-btn").addEventListener("click", () => {
        window.location.href = "/api/settings-page/";
    });

    const addBookBtn = document.getElementById("add-book-btn");
    if (addBookBtn) {
        addBookBtn.addEventListener("click", () => {
            window.location.href = "/api/add-book-page/";
        });
    }

    setupFiltersAndSortSuite();
    setupSortPopover();
    setupClearTags();
    await loadLibraryData();

    // Check query redirects
    const urlParams = new URLSearchParams(window.location.search);
    const authorParam = urlParams.get('author');
    const searchInput = document.getElementById("search-input");

    if (authorParam && searchInput) {
        searchInput.value = authorParam;
        searchQuery = authorParam.toLowerCase();
        applyFiltersAndSorts();
    }
});

// --- Fetch Library Data ---
async function loadLibraryData() {
    try {
        const response = await apiFetch("/api/userbooks/");
        if (!response.ok) throw new Error("Failed to load books");
        
        allBooksData = await response.json();
        generateTagShelves();
        applyFiltersAndSorts();
    } catch (error) {
        console.error("Error fetching library data:", error);
    }
}

// --- Dynamic Shelf (Tag) Generator ---
function generateTagShelves() {
    const container = document.getElementById("tag-shelves-container");
    if (!container) return;

    const uniqueTags = new Set(); 
    allBooksData.forEach(userbook => {
        if (userbook.tags) {
            userbook.tags.forEach(tag => uniqueTags.add(tag.name));
        }
    });

    if (uniqueTags.size === 0) {
        container.innerHTML = `<span class="text-secondary text-sm">No shelf tags found.</span>`;
        return;
    }

    container.innerHTML = Array.from(uniqueTags).sort().map(tag => `
        <button type="button" class="shelf-toggle" data-tag="${tag}">
            #${tag}
        </button>
    `).join("");

    container.querySelectorAll(".shelf-toggle").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const tag = e.target.getAttribute("data-tag");
            
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                e.target.classList.remove("active");
            } else {
                selectedTags.add(tag);
                e.target.classList.add("active");
            }
            
            updateClearTagsVisibility();
            applyFiltersAndSorts(); 
        });
    });
}

// --- Sort Popover Logic ---
function setupSortPopover() {
    const trigger = document.getElementById("sort-trigger-btn");
    const popover = document.getElementById("sort-popover");
    if (!trigger || !popover) return;

    // Toggle popover open/close
    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        popover.classList.toggle("is-open");
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!popover.contains(e.target) && !trigger.contains(e.target)) {
            popover.classList.remove("is-open");
        }
    });

    // Sort property options
    popover.querySelectorAll(".sort-popover__option").forEach(opt => {
        opt.addEventListener("click", () => {
            popover.querySelectorAll(".sort-popover__option").forEach(o => o.classList.remove("is-active"));
            opt.classList.add("is-active");
            sortProperty = opt.getAttribute("data-sort");
            applyFiltersAndSorts();
        });
    });

    // Direction toggles
    popover.querySelectorAll(".sort-popover__dir").forEach(btn => {
        btn.addEventListener("click", () => {
            popover.querySelectorAll(".sort-popover__dir").forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            sortDirection = btn.getAttribute("data-dir");
            applyFiltersAndSorts();
        });
    });
}

// --- Clear Tags Button ---
function setupClearTags() {
    const clearBtn = document.getElementById("clear-tags-btn");
    if (!clearBtn) return;

    clearBtn.addEventListener("click", () => {
        selectedTags.clear();
        document.querySelectorAll(".shelf-toggle.active").forEach(btn => btn.classList.remove("active"));
        updateClearTagsVisibility();
        applyFiltersAndSorts();
    });
}

function updateClearTagsVisibility() {
    const clearBtn = document.getElementById("clear-tags-btn");
    if (clearBtn) {
        clearBtn.classList.toggle("is-visible", selectedTags.size > 0);
    }
}

// --- Event Listeners ---
function setupFiltersAndSortSuite() {
    document.getElementById("search-input").addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFiltersAndSorts();
    });

    const statusItems = document.querySelectorAll(".status-item");
    statusItems.forEach(item => {
        item.addEventListener("click", (e) => {
            statusItems.forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            
            selectedStatus = e.target.getAttribute("data-status");
            applyFiltersAndSorts();
        });
    });
}

// --- Unified Filter/Sorter Pipeline ---
function applyFiltersAndSorts() {
    let processedBooks = allBooksData.filter(book => {
        const matchesStatus = (selectedStatus === "ALL" || book.status === selectedStatus);
        
        const matchesSearch = (searchQuery === "" || 
            (book.title && book.title.toLowerCase().includes(searchQuery)) || 
            (book.author && book.author.toLowerCase().includes(searchQuery))
        );
        
        let matchesTags = true;
        if (selectedTags.size > 0) {
            if (!book.tags) {
                matchesTags = false;
            } else {
                const bookTagNames = book.tags.map(t => t.name);
                for (let requiredTag of selectedTags) {
                    if (!bookTagNames.includes(requiredTag)) {
                        matchesTags = false;
                        break;
                    }
                }
            }
        }
        
        return matchesStatus && matchesSearch && matchesTags;
    });

    // Read sort state from internal variables (not DOM)
    const property = sortProperty;
    const direction = sortDirection;

    processedBooks.sort((a, b) => {
        let valA, valB;

        switch (property) {
            case "title":
                valA = (a.title || "").toLowerCase();
                valB = (b.title || "").toLowerCase();
                break;
            case "rating":
                valA = parseFloat(a.rating) || 0;
                valB = parseFloat(b.rating) || 0;
                break;
            case "start_date":
                valA = a.start_date ? new Date(a.start_date) : new Date(0);
                valB = b.start_date ? new Date(b.start_date) : new Date(0);
                break;
            case "finish_date":
                valA = a.finish_date ? new Date(a.finish_date) : new Date(0);
                valB = b.finish_date ? new Date(b.finish_date) : new Date(0);
                break;
            case "date_added":
            default:
                valA = a.id;
                valB = b.id;
                break;
        }

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });

    renderBooks(processedBooks);
}

function switchView(view) {
    currentView = view;
    const container = document.getElementById("books-container");
    container.className = view === "grid" ? "books-grid" : "books-list";
    
    document.getElementById("grid-view-btn").classList.toggle("active-view", view === "grid");
    document.getElementById("list-view-btn").classList.toggle("active-view", view === "list");
    applyFiltersAndSorts(); 
}

// --- UI Rendering ---
function renderBooks(books) {
    const container = document.getElementById("books-container");
    container.className = currentView === "grid" ? "books-grid" : "books-list";
    container.innerHTML = ""; 

    if (books.length === 0) {
        container.innerHTML = `
            <div class="text-center text-secondary" style="grid-column: 1 / -1; padding: 4rem;">
                <p style="font-size: 1.1rem;">No volumes match the active shelf filters.</p>
            </div>`;
        return;
    }

    books.forEach(book => {
        const card = document.createElement("div");
        card.className = currentView === "grid" ? "book-card" : "book-row";
        
        card.addEventListener("click", (e) => {
            if (!e.target.classList.contains("author-link")) {
                window.location.href = `/api/book/${book.id}/`;
            }
        });

        const coverImage = book.cover_image || "/static/books/images/book-placeholder.png";
        const author = book.author || "Unknown Author";
        const statusLabel = getStatusLabel(book.status);
        const tagsHtml = book.tags ? book.tags.map(tag => `<span class="tag-chip">#${tag.name}</span>`).join("") : "";

        if (currentView === "grid") {
            card.innerHTML = `
                <img src="${coverImage}" class="book-cover" alt="Cover">
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">
                        <span class="author-link">${author}</span>
                    </div>
                    <div class="book-status">${statusLabel}</div>
                    <div class="book-tags">${tagsHtml}</div>
                </div>`;
        } else {
            card.innerHTML = `
                <img src="${coverImage}" class="list-cover" alt="Cover">
                <div class="list-title">${book.title}</div>
                <div class="list-author">
                    <span class="author-link">${author}</span>
                </div>
                <div class="list-status">${statusLabel}</div>
                <div class="list-tags">${tagsHtml}</div>`;
        }
        container.appendChild(card);
    });

    container.querySelectorAll(".author-link").forEach(link => {
        link.addEventListener("click", (e) => {
            const authorName = e.target.textContent.trim();
            const searchInput = document.getElementById("search-input");
            
            if (searchInput) {
                searchInput.value = authorName; 
                searchQuery = authorName.toLowerCase();
                applyFiltersAndSorts();
            }
        });
    });
}

function getStatusLabel(status) {
    const labels = { "WANT": "Want To Read", "READ": "Finished", "READING": "Reading", "DNF": "Did Not Finish" };
    return labels[status] || status;
}