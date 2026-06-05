// --- Global State ---
let currentTags = [];
let CURRENT_BOOK_ID = null;

// --- API Wrapper ---
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

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    // Safely grab the ID that we declared at the bottom of book_info.html
    if (typeof DJANGO_BOOK_ID !== 'undefined' && DJANGO_BOOK_ID !== "") {
        CURRENT_BOOK_ID = DJANGO_BOOK_ID;
    } else {
        console.error("Could not find Book ID. Make sure DJANGO_BOOK_ID is in the HTML.");
        return;
    }

    await fetchAndPopulateData();

    // Setup the Add Tag listeners (Mouse Click + Enter Key)
    const addTagBtn = document.getElementById("add-tag-btn");
    const tagInput = document.getElementById("new-tag-input");

    if (addTagBtn) {
        addTagBtn.addEventListener("click", handleAddTag);
    }

    if (tagInput) {
        tagInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); 
                handleAddTag();
            }
        });
    }

    // NEW: Setup the form submission listener
    const updateForm = document.getElementById("book-update-form");
    if (updateForm) {
        updateForm.addEventListener("submit", handleFormSubmit);
    }

    // (Inside your DOMContentLoaded block, add this listener at the very bottom)
    const deleteBtn = document.getElementById("delete-book-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", handleDeleteBook);
    }
});

// --- Data Fetching ---
async function fetchAndPopulateData() {
    try {
        const response = await apiFetch(`/api/userbooks/${CURRENT_BOOK_ID}/`);
        if (!response.ok) throw new Error("Failed to fetch book data");
        
        const data = await response.json();
        
        // 1. Populate Header info
        document.getElementById("detail-title").textContent = data.book_title;
        
        // Locate this section inside fetchAndPopulateData():
        document.getElementById("detail-title").textContent = data.book_title;
        
        const authorEl = document.getElementById("detail-author");
        if (authorEl) {
            const authorName = data.author || "Unknown Author";
            authorEl.textContent = authorName;
            
            if (data.author) {
                // THE FIX: Point back to your local library root instead of the add-book page
                authorEl.href = `/api/?author=${encodeURIComponent(authorName)}`;
            } else {
                authorEl.style.pointerEvents = "none";
            }
        }
        
        const coverUrl = data.cover_image || "/static/books/images/book-placeholder.png";
        document.getElementById("detail-cover").src = coverUrl;

        // 2. Populate the Reading Journey form fields
        if (data.status) document.getElementById("detail-status").value = data.status;
        if (data.rating) document.getElementById("detail-rating").value = data.rating;
        if (data.start_date) document.getElementById("detail-start-date").value = data.start_date;
        if (data.finish_date) document.getElementById("detail-finish-date").value = data.finish_date;
        if (data.notes) document.getElementById("detail-notes").value = data.notes;

        // 3. Populate Tags array and render
        currentTags = data.tags ? data.tags.map(t => t.name) : [];
        renderTags();

        // 4. THE FIX: Populate E-Book File
        const ebookContainer = document.getElementById("ebook-container");
        if (data.ebook_file && ebookContainer) {
            // Extract just the filename from the end of the URL for a cleaner display
            const fileName = data.ebook_file.split('/').pop(); 
            
            // Generate a clean row with the filename and a download button
            ebookContainer.innerHTML = `
                <div class="flex gap-sm" style="align-items: center; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                    <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem;">
                        📄 ${fileName}
                    </div>
                    <a href="${data.ebook_file}" target="_blank" download class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; text-decoration: none;">
                        Download
                    </a>
                </div>
            `;
        }

    } catch (error) {
        console.error("Error loading details:", error);
    }
}

// --- UI Rendering ---
function renderTags() {
    const container = document.getElementById("detail-tags");
    if (!container) return;
    
    if (currentTags.length === 0) {
        container.innerHTML = '<span class="text-secondary text-sm">No tags added.</span>';
        return;
    }

    container.innerHTML = currentTags.map(tag => `
        <span class="tag-chip">
            ${tag} 
            <span class="remove-tag" data-tag="${tag}">&times;</span>
        </span>
    `).join("");

    document.querySelectorAll(".remove-tag").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const tagToRemove = e.target.getAttribute("data-tag");
            currentTags = currentTags.filter(t => t !== tagToRemove);
            renderTags(); 
            await syncTags(); 
        });
    });
}

// --- Tag Logic ---
async function handleAddTag() {
    const input = document.getElementById("new-tag-input");
    if (!input) return;

    const newTag = input.value.trim().toLowerCase();
    
    if (newTag && !currentTags.includes(newTag)) {
        currentTags.push(newTag);
        input.value = ""; 
        renderTags();     
        await syncTags(); 
    }
}

async function syncTags() {
    try {
        const response = await apiFetch(`/api/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag_names: currentTags })
        });
        
        if (!response.ok) {
            console.error("Failed to sync tags to database");
        }
    } catch (error) {
        console.error("Tag sync network error:", error);
    }
}

// --- NEW: Form Submission Logic ---
async function handleFormSubmit(e) {
    e.preventDefault(); // Prevent the page from refreshing
    
    const submitBtn = document.getElementById("save-btn");
    const statusMsg = document.getElementById("status-message");

    // UI Feedback: Show saving state
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
    statusMsg.style.display = "none";

    // Gather the data from the form
    const payload = {
        status: document.getElementById("detail-status").value,
        rating: document.getElementById("detail-rating").value || null, // Convert empty string to null
        start_date: document.getElementById("detail-start-date").value || null,
        finish_date: document.getElementById("detail-finish-date").value || null,
        notes: document.getElementById("detail-notes").value
    };

    try {
        const response = await apiFetch(`/api/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Success Feedback
            statusMsg.textContent = "Reading journey updated successfully!";
            statusMsg.style.color = "#10b981"; // Success green
        } else {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to save changes");
        }
    } catch (error) {
        console.error("Save error:", error);
        // Error Feedback
        statusMsg.textContent = "Error saving changes. Please try again.";
        statusMsg.style.color = "var(--danger)";
    } finally {
        // Reset UI
        statusMsg.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Changes";
        
        // Hide the success message after 3 seconds so it doesn't linger
        setTimeout(() => {
            statusMsg.style.display = "none";
        }, 3000);
    }
}

// --- NEW: Book Deletion Logic ---
async function handleDeleteBook() {
    const confirmDeletion = confirm("Are you absolutely sure you want to remove this book from your library? This action cannot be undone.");
    
    if (!confirmDeletion) {
        return; // User canceled the warning action, exit safely
    }

    const deleteBtn = document.getElementById("delete-book-btn");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Removing...";

    try {
        const response = await apiFetch(`/api/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "DELETE"
        });

        if (response.status === 204 || response.ok) {
            // Successfully unlinked. Route them right back to their custom main dashboard collection root
            window.location.replace("/api/");
        } else {
            throw new Error("Deletion failed on server side processing.");
        }
    } catch (error) {
        console.error("Delete Error:", error);
        alert("Could not complete removal. Please try again later.");
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Delete Book";
    }
}