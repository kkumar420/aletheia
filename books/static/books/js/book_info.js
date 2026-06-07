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

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof DJANGO_BOOK_ID !== 'undefined' && DJANGO_BOOK_ID !== "") {
        CURRENT_BOOK_ID = DJANGO_BOOK_ID;
    } else {
        console.error("Could not find Book ID.");
        return;
    }

    await fetchAndPopulateData();

    // Tag listeners
    const addTagBtn = document.getElementById("add-tag-btn");
    const tagInput = document.getElementById("new-tag-input");
    if (addTagBtn) addTagBtn.addEventListener("click", handleAddTag);
    if (tagInput) tagInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); handleAddTag(); }
    });

    // Form submission
    const updateForm = document.getElementById("book-update-form");
    if (updateForm) updateForm.addEventListener("submit", handleFormSubmit);

    // Delete button
    const deleteBtn = document.getElementById("delete-book-btn");
    if (deleteBtn) deleteBtn.addEventListener("click", handleDeleteBook);

    // Ebook upload
    const ebookUploadBtn = document.getElementById("ebook-upload-btn");
    const ebookFileInput = document.getElementById("ebook-file-input");
    if (ebookUploadBtn && ebookFileInput) {
        ebookUploadBtn.addEventListener("click", () => ebookFileInput.click());
        ebookFileInput.addEventListener("change", handleEbookUpload);
    }

    // Edit details toggle
    const editToggle = document.getElementById("edit-toggle-btn");
    if (editToggle) editToggle.addEventListener("click", toggleEditDetails);

    // Edit cover upload
    const editCoverBtn = document.getElementById("edit-cover-btn");
    const editCoverInput = document.getElementById("edit-cover-input");
    if (editCoverBtn && editCoverInput) {
        editCoverBtn.addEventListener("click", () => editCoverInput.click());
        editCoverInput.addEventListener("change", () => {
            const file = editCoverInput.files[0];
            if (file) {
                const preview = document.getElementById("edit-cover-preview");
                preview.src = URL.createObjectURL(file);
                preview.style.display = "block";
            }
        });
    }

    // Save details button
    const saveDetailsBtn = document.getElementById("save-details-btn");
    if (saveDetailsBtn) saveDetailsBtn.addEventListener("click", handleSaveDetails);
});

// --- Edit Details Toggle ---
function toggleEditDetails() {
    const form = document.getElementById("edit-details-form");
    form.classList.toggle("is-open");
}

// --- Data Fetching ---
async function fetchAndPopulateData() {
    try {
        const response = await apiFetch(`/userbooks/${CURRENT_BOOK_ID}/`);
        if (!response.ok) throw new Error("Failed to fetch book data");
        
        const data = await response.json();
        
        // Populate Header info
        document.getElementById("detail-title").textContent = data.book_title;
        
        const authorEl = document.getElementById("detail-author");
        if (authorEl) {
            const authorName = data.author || "Unknown Author";
            authorEl.textContent = authorName;
            if (data.author) {
                authorEl.href = `/?author=${encodeURIComponent(authorName)}`;
            } else {
                authorEl.style.pointerEvents = "none";
            }
        }
        
        const coverUrl = data.cover_image || "/static/books/images/book-placeholder.png";
        document.getElementById("detail-cover").src = coverUrl;

        // Populate edit form with current custom values
        const editTitle = document.getElementById("edit-title");
        const editAuthor = document.getElementById("edit-author");
        if (editTitle) editTitle.value = data.custom_title || "";
        if (editAuthor) editAuthor.value = data.custom_author || "";

        // Populate the Reading Journey form fields
        if (data.status) document.getElementById("detail-status").value = data.status;
        if (data.rating) document.getElementById("detail-rating").value = data.rating;
        if (data.start_date) document.getElementById("detail-start-date").value = data.start_date;
        if (data.finish_date) document.getElementById("detail-finish-date").value = data.finish_date;
        if (data.notes) document.getElementById("detail-notes").value = data.notes;

        // Populate Tags
        currentTags = data.tags ? data.tags.map(t => t.name) : [];
        renderTags();

        // Populate E-Book File
        const ebookContainer = document.getElementById("ebook-container");
        if (data.ebook_file && ebookContainer) {
            const fileName = data.ebook_file.split('/').pop(); 
            ebookContainer.innerHTML = `
                <div class="ebook-file-row">
                    <div class="ebook-file-row__name">📄 ${fileName}</div>
                    <a href="${data.ebook_file}" target="_blank" download class="btn btn-primary ebook-file-row__download">Download</a>
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
        const response = await apiFetch(`/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tag_names: currentTags })
        });
        if (!response.ok) console.error("Failed to sync tags");
    } catch (error) {
        console.error("Tag sync error:", error);
    }
}

// --- Save Custom Details (Override Architecture) ---
async function handleSaveDetails() {
    const saveBtn = document.getElementById("save-details-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const formData = new FormData();
    
    const customTitle = document.getElementById("edit-title").value.trim();
    const customAuthor = document.getElementById("edit-author").value.trim();
    const coverFile = document.getElementById("edit-cover-input").files[0];

    formData.append("custom_title", customTitle);
    formData.append("custom_author", customAuthor);
    if (coverFile) {
        formData.append("custom_cover", coverFile);
    }

    try {
        const token = localStorage.getItem("access");
        const response = await fetch(`/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            saveBtn.textContent = "Saved ✓";
            // Refresh the display with new data
            await fetchAndPopulateData();
            // Close the edit form
            document.getElementById("edit-details-form").classList.remove("is-open");
            
            setTimeout(() => {
                saveBtn.textContent = "Save Details";
                saveBtn.disabled = false;
            }, 1500);
        } else {
            throw new Error("Failed to save");
        }
    } catch (error) {
        console.error("Save details error:", error);
        saveBtn.textContent = "Error!";
        setTimeout(() => {
            saveBtn.textContent = "Save Details";
            saveBtn.disabled = false;
        }, 2000);
    }
}

// --- Form Submission Logic (with Save Redirect) ---
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById("save-btn");
    const statusMsg = document.getElementById("status-message");

    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
    statusMsg.style.display = "none";

    const payload = {
        status: document.getElementById("detail-status").value,
        rating: document.getElementById("detail-rating").value || null,
        start_date: document.getElementById("detail-start-date").value || null,
        finish_date: document.getElementById("detail-finish-date").value || null,
        notes: document.getElementById("detail-notes").value
    };

    let redirecting = false;

    try {
        const response = await apiFetch(`/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            redirecting = true;
            submitBtn.textContent = "Saved ✓";
            setTimeout(() => { window.location.href = "/"; }, 600);
        } else {
            const errData = await response.json();
            throw new Error(errData.detail || "Failed to save changes");
        }
    } catch (error) {
        console.error("Save error:", error);
        statusMsg.textContent = "Error saving changes. Please try again.";
        statusMsg.style.color = "var(--danger)";
    } finally {
        if (!redirecting) {
            statusMsg.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Changes";
            setTimeout(() => { statusMsg.style.display = "none"; }, 3000);
        }
    }
}

// --- Ebook Upload Logic ---
async function handleEbookUpload() {
    const fileInput = document.getElementById("ebook-file-input");
    const file = fileInput.files[0];
    if (!file) return;

    const uploadBtn = document.getElementById("ebook-upload-btn");
    const originalHtml = uploadBtn.innerHTML;
    uploadBtn.innerHTML = "Uploading...";
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append("ebook_file", file);

    try {
        const token = localStorage.getItem("access");
        const response = await fetch(`/userbooks/${CURRENT_BOOK_ID}/`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            const ebookContainer = document.getElementById("ebook-container");
            if (data.ebook_file && ebookContainer) {
                const fileName = data.ebook_file.split('/').pop();
                ebookContainer.innerHTML = `
                    <div class="ebook-file-row">
                        <div class="ebook-file-row__name">📄 ${fileName}</div>
                        <a href="${data.ebook_file}" target="_blank" download class="btn btn-primary ebook-file-row__download">Download</a>
                    </div>
                `;
            }
        } else {
            throw new Error("Upload failed");
        }
    } catch (error) {
        console.error("Ebook upload error:", error);
        alert("Failed to upload file. Please try again.");
    } finally {
        uploadBtn.innerHTML = originalHtml;
        uploadBtn.disabled = false;
        fileInput.value = "";
    }
}

// --- Book Deletion Logic ---
async function handleDeleteBook() {
    const confirmDeletion = confirm("Are you absolutely sure you want to remove this book from your library? This action cannot be undone.");
    if (!confirmDeletion) return;

    const deleteBtn = document.getElementById("delete-book-btn");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Removing...";

    try {
        const response = await apiFetch(`/userbooks/${CURRENT_BOOK_ID}/`, { method: "DELETE" });

        if (response.status === 204 || response.ok) {
            window.location.replace("/");
        } else {
            throw new Error("Deletion failed");
        }
    } catch (error) {
        console.error("Delete Error:", error);
        alert("Could not complete removal. Please try again later.");
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Delete Book";
    }
}