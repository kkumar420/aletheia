// --- Global Filter/Sorting States ---
let allBooksData = [];
let selectedStatuses = new Set();
let selectedTags = new Set();
let currentView = localStorage.getItem("dashboardView") || "grid";
let searchQuery = "";
let sortProperty = localStorage.getItem("dashboardSortProp") || "date_added";
let sortDirection = localStorage.getItem("dashboardSortDir") || "desc";
let selectedBookIds = new Set(); // Bulk selection tracking

// --- API Fetch Wrapper ---
async function apiFetch(url, options = {}) {
    let token = localStorage.getItem("access");
    options.headers = { ...options.headers, "Authorization": `Bearer ${token}` };

    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshToken = localStorage.getItem("refresh");
        if (!refreshToken) {
            window.location.replace("/login-page/");
            return response;
        }

        const refreshResponse = await fetch("/token/refresh/", {
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
            window.location.replace("/login-page/");
        }
    }
    return response;
}

// --- Initialization Block ---
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("access");
    if (!token) { window.location.replace("/login-page/"); return; }

    // Layout view toggles
    document.getElementById("grid-view-btn").addEventListener("click", () => switchView("grid"));
    document.getElementById("list-view-btn").addEventListener("click", () => switchView("list"));

    // Set initial view state visually from localStorage
    const container = document.getElementById("books-container");
    if (container) container.className = currentView === "grid" ? "books-grid" : "books-list";
    document.getElementById("grid-view-btn").classList.toggle("active-view", currentView === "grid");
    document.getElementById("list-view-btn").classList.toggle("active-view", currentView === "list");
    
    document.getElementById("settings-btn").addEventListener("click", () => {
        window.location.href = "/settings-page/";
    });

    const addBookBtn = document.getElementById("add-book-btn");
    if (addBookBtn) {
        addBookBtn.addEventListener("click", () => {
            window.location.href = "/add-book-page/";
        });
    }

    setupFiltersAndSortSuite();
    setupSortPopover();
    setupClearTags();
    setupBulkActions();
    setupTagManager();
    setupSearchClear();
    setupEscapeKey();
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
        const response = await apiFetch("/userbooks/");
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
        <button type="button" class="shelf-toggle${selectedTags.has(tag) ? ' active' : ''}" data-tag="${tag}">
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

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        popover.classList.toggle("is-open");
    });

    document.addEventListener("click", (e) => {
        if (!popover.contains(e.target) && !trigger.contains(e.target)) {
            popover.classList.remove("is-open");
        }
    });

    // Set initial visual state from localStorage
    popover.querySelectorAll(".sort-popover__option").forEach(opt => {
        if (opt.getAttribute("data-sort") === sortProperty) {
            opt.classList.add("is-active");
        } else {
            opt.classList.remove("is-active");
        }
    });

    popover.querySelectorAll(".sort-popover__dir").forEach(btn => {
        if (btn.getAttribute("data-dir") === sortDirection) {
            btn.classList.add("is-active");
        } else {
            btn.classList.remove("is-active");
        }
    });

    popover.querySelectorAll(".sort-popover__option").forEach(opt => {
        opt.addEventListener("click", () => {
            popover.querySelectorAll(".sort-popover__option").forEach(o => o.classList.remove("is-active"));
            opt.classList.add("is-active");
            sortProperty = opt.getAttribute("data-sort");
            localStorage.setItem("dashboardSortProp", sortProperty);
            applyFiltersAndSorts();
        });
    });

    popover.querySelectorAll(".sort-popover__dir").forEach(btn => {
        btn.addEventListener("click", () => {
            popover.querySelectorAll(".sort-popover__dir").forEach(b => b.classList.remove("is-active"));
            btn.classList.add("is-active");
            sortDirection = btn.getAttribute("data-dir");
            localStorage.setItem("dashboardSortDir", sortDirection);
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

// ==========================================
// BULK ACTIONS
// ==========================================

function setupBulkActions() {
    const deleteBtn = document.getElementById("bulk-delete-btn");
    const cancelBtn = document.getElementById("bulk-cancel-btn");

    if (deleteBtn) deleteBtn.addEventListener("click", handleBulkDelete);
    if (cancelBtn) cancelBtn.addEventListener("click", clearBulkSelection);
}

function toggleBulkSelection(bookId, checkbox, card) {
    if (checkbox.checked) {
        selectedBookIds.add(bookId);
        card.classList.add("is-selected");
    } else {
        selectedBookIds.delete(bookId);
        card.classList.remove("is-selected");
    }
    updateBulkBar();
}

function updateBulkBar() {
    const bar = document.getElementById("bulk-action-bar");
    const countEl = document.getElementById("bulk-count");
    const count = selectedBookIds.size;

    if (count > 0) {
        bar.classList.add("is-visible");
        countEl.textContent = `${count} selected`;
    } else {
        bar.classList.remove("is-visible");
    }
}

function clearBulkSelection() {
    selectedBookIds.clear();
    document.querySelectorAll(".book-card__check, .book-row__check").forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll(".is-selected").forEach(el => {
        el.classList.remove("is-selected");
    });
    updateBulkBar();
}

async function handleBulkDelete() {
    const count = selectedBookIds.size;
    if (count === 0) return;

    const confirmed = confirm(`Are you sure you want to delete ${count} book${count > 1 ? 's' : ''} from your library? This cannot be undone.`);
    if (!confirmed) return;

    const deleteBtn = document.getElementById("bulk-delete-btn");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";

    try {
        const response = await apiFetch("/userbooks/bulk-delete/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(selectedBookIds) })
        });

        if (response.ok) {
            // Remove deleted books from local cache
            allBooksData = allBooksData.filter(b => !selectedBookIds.has(String(b.id)));
            clearBulkSelection();
            generateTagShelves();
            applyFiltersAndSorts();
        } else {
            throw new Error("Bulk delete failed");
        }
    } catch (error) {
        console.error("Bulk delete error:", error);
        alert("Failed to delete selected books. Please try again.");
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4M13.33 4l-.67 9.33a1.33 1.33 0 0 1-1.33 1.34H4.67a1.33 1.33 0 0 1-1.33-1.34L2.67 4"/></svg> Delete Selected`;
    }
}

// ==========================================
// TAG MANAGER MODAL
// ==========================================

function setupTagManager() {
    const manageBtn = document.getElementById("manage-tags-btn");
    const closeBtn = document.getElementById("close-tag-modal");
    const modal = document.getElementById("tag-manager-modal");

    if (manageBtn) manageBtn.addEventListener("click", openTagManager);
    if (closeBtn) closeBtn.addEventListener("click", closeTagManager);
    
    // Close on backdrop click
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeTagManager();
        });
    }
}

async function openTagManager() {
    const modal = document.getElementById("tag-manager-modal");
    const listContainer = document.getElementById("tag-manager-list");
    modal.classList.add("is-open");

    // Fetch all tags from the API (gives us IDs needed for deletion)
    try {
        const response = await apiFetch("/tags/");
        if (!response.ok) throw new Error("Failed to fetch tags");
        const tags = await response.json();

        if (tags.length === 0) {
            listContainer.innerHTML = `<p class="text-secondary text-sm" style="padding: 1rem 0;">No tags in your library yet.</p>`;
            return;
        }

        // Count how many books use each tag
        const tagCounts = {};
        allBooksData.forEach(book => {
            if (book.tags) {
                book.tags.forEach(t => {
                    tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
                });
            }
        });

        listContainer.innerHTML = tags.map(tag => `
            <div class="tag-manager-row" data-tag-id="${tag.id}">
                <div class="tag-manager-row__info">
                    <span class="tag-manager-row__name">#${tag.name}</span>
                    <span class="tag-manager-row__count">${tagCounts[tag.name] || 0} books</span>
                </div>
                <button type="button" class="tag-manager-row__delete" data-tag-id="${tag.id}" data-tag-name="${tag.name}" title="Delete tag">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 0 1 1.34-1.34h2.66a1.33 1.33 0 0 1 1.34 1.34V4M13.33 4l-.67 9.33a1.33 1.33 0 0 1-1.33 1.34H4.67a1.33 1.33 0 0 1-1.33-1.34L2.67 4"/></svg>
                </button>
            </div>
        `).join("");

        listContainer.querySelectorAll(".tag-manager-row__delete").forEach(btn => {
            btn.addEventListener("click", () => handleDeleteTag(btn.dataset.tagId, btn.dataset.tagName));
        });
    } catch (error) {
        console.error("Tag manager error:", error);
        listContainer.innerHTML = `<p class="text-secondary text-sm">Failed to load tags.</p>`;
    }
}

function closeTagManager() {
    document.getElementById("tag-manager-modal").classList.remove("is-open");
}

async function handleDeleteTag(tagId, tagName) {
    const confirmed = confirm(`Delete the tag "#${tagName}" from all books in your library?`);
    if (!confirmed) return;

    try {
        const response = await apiFetch(`/tags/${tagId}/`, { method: "DELETE" });

        if (response.ok || response.status === 204) {
            // Remove from local data
            allBooksData.forEach(book => {
                if (book.tags) {
                    book.tags = book.tags.filter(t => t.name !== tagName);
                }
            });

            // Remove from selected filters
            selectedTags.delete(tagName);
            updateClearTagsVisibility();

            // Remove the row from the modal
            const row = document.querySelector(`.tag-manager-row[data-tag-id="${tagId}"]`);
            if (row) row.remove();

            // Refresh the sidebar and book display
            generateTagShelves();
            applyFiltersAndSorts();
        } else {
            throw new Error("Delete failed");
        }
    } catch (error) {
        console.error("Tag delete error:", error);
        alert("Failed to delete tag. Please try again.");
    }
}

// --- Search Clear Button ---
function setupSearchClear() {
    const clearBtn = document.getElementById("search-clear-btn");
    const searchInput = document.getElementById("search-input");
    if (!clearBtn || !searchInput) return;

    // Show/hide the X based on input content
    searchInput.addEventListener("input", () => {
        clearBtn.classList.toggle("is-visible", searchInput.value.length > 0);
    });

    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchQuery = "";
        clearBtn.classList.remove("is-visible");
        applyFiltersAndSorts();
    });
}

// --- Escape Key Handler ---
function setupEscapeKey() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            // Precedence 1: Clear multi-select if active
            if (selectedBookIds.size > 0) {
                clearBulkSelection();
                return;
            }
            // Precedence 2: Clear the search bar and reset view
            const searchInput = document.getElementById("search-input");
            const clearBtn = document.getElementById("search-clear-btn");
            if (searchInput && searchInput.value) {
                searchInput.value = "";
                searchQuery = "";
                if (clearBtn) clearBtn.classList.remove("is-visible");
                applyFiltersAndSorts();
            }
        }
    });
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
            const status = e.target.getAttribute("data-status");
            
            if (status === "ALL") {
                selectedStatuses.clear();
                statusItems.forEach(btn => btn.classList.remove("active"));
                e.target.classList.add("active");
            } else {
                // If "ALL" was previously active, un-active it
                document.querySelector('.status-item[data-status="ALL"]').classList.remove("active");
                
                if (selectedStatuses.has(status)) {
                    selectedStatuses.delete(status);
                    e.target.classList.remove("active");
                } else {
                    selectedStatuses.add(status);
                    e.target.classList.add("active");
                }
                
                // If nothing is selected, revert to ALL
                if (selectedStatuses.size === 0) {
                    document.querySelector('.status-item[data-status="ALL"]').classList.add("active");
                }
            }
            
            applyFiltersAndSorts();
        });
    });
}

// --- Unified Filter/Sorter Pipeline ---
function applyFiltersAndSorts() {
    let processedBooks = allBooksData.filter(book => {
        const matchesStatus = (selectedStatuses.size === 0 || selectedStatuses.has(book.status));
        
        const bookTitle = book.title || "";
        const bookAuthor = book.author || "";
        const matchesSearch = (searchQuery === "" || 
            bookTitle.toLowerCase().includes(searchQuery) || 
            bookAuthor.toLowerCase().includes(searchQuery)
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
                valA = a.added_at ? new Date(a.added_at) : new Date(0);
                valB = b.added_at ? new Date(b.added_at) : new Date(0);
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
    localStorage.setItem("dashboardView", view);
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
        const bookId = String(book.id);
        const isSelected = selectedBookIds.has(bookId);

        card.className = currentView === "grid" 
            ? `book-card${isSelected ? ' is-selected' : ''}` 
            : `book-row${isSelected ? ' is-selected' : ''}`;
        
        card.addEventListener("click", (e) => {
            if (e.target.classList.contains("author-link") || 
                e.target.classList.contains("book-card__check") || 
                e.target.classList.contains("book-row__check") ||
                e.target.classList.contains("tag-chip")) return;
            window.location.href = `/book/${book.id}/`;
        });

        const coverImage = book.cover_image || "/static/books/images/book-placeholder.png";
        const author = book.author || "Unknown Author";
        const statusLabel = getStatusLabel(book.status);
        const tagsHtml = book.tags ? book.tags.map(tag => `<span class="tag-chip" data-tag="${tag.name}">#${tag.name}</span>`).join("") : "";
        const ratingHtml = book.rating ? `<div class="book-rating">⭐ ${book.rating}/5</div>` : "";

        if (currentView === "grid") {
            card.innerHTML = `
                <input type="checkbox" class="book-card__check" data-id="${bookId}" ${isSelected ? 'checked' : ''}>
                <img src="${coverImage}" class="book-cover" alt="Cover">
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">
                        <span class="author-link">${author}</span>
                    </div>
                    <div class="book-status">${statusLabel}</div>
                    ${ratingHtml}
                    <div class="book-tags">${tagsHtml}</div>
                </div>`;
        } else {
            card.innerHTML = `
                <input type="checkbox" class="book-row__check" data-id="${bookId}" ${isSelected ? 'checked' : ''}>
                <img src="${coverImage}" class="list-cover" alt="Cover">
                <div class="list-title">${book.title}</div>
                <div class="list-author">
                    <span class="author-link">${author}</span>
                </div>
                <div class="list-status">${statusLabel}</div>
                ${ratingHtml}
                <div class="list-tags">${tagsHtml}</div>`;
        }
        container.appendChild(card);
    });

    // Bind checkboxes
    container.querySelectorAll(".book-card__check, .book-row__check").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            e.stopPropagation();
            const card = e.target.closest(".book-card, .book-row");
            toggleBulkSelection(e.target.dataset.id, e.target, card);
        });
        checkbox.addEventListener("click", (e) => e.stopPropagation());
    });

    // Bind author links
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

    // Bind tag chips
    container.querySelectorAll(".tag-chip").forEach(tag => {
        tag.addEventListener("click", (e) => {
            const tagName = e.target.getAttribute("data-tag");
            if (!selectedTags.has(tagName)) {
                selectedTags.add(tagName);
                
                // Update UI visually
                const shelfToggles = document.querySelectorAll(`.shelf-toggle[data-tag="${tagName}"]`);
                shelfToggles.forEach(btn => btn.classList.add("active"));
                updateClearTagsVisibility();
                
                applyFiltersAndSorts();
            }
        });
    });
}

function getStatusLabel(status) {
    const labels = { "WANT": "Want To Read", "READ": "Finished", "READING": "Reading", "DNF": "Did Not Finish" };
    return labels[status] || status;
}