// --- API Wrapper ---
async function apiFetch(url, options = {}) {
    let token = localStorage.getItem("access");
    options.headers = { ...options.headers, "Authorization": `Bearer ${token}` };

    let response = await fetch(url, options);

    if (response.status === 401) {
        // ... (Your standard token refresh logic here, identical to your other files) ...
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

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check Authentication
    if (!localStorage.getItem("access")) {
        window.location.replace("/login-page/");
        return;
    }

    // 2. Initialize Theme Toggle
    const themeToggle = document.getElementById("theme-toggle");
    const currentTheme = localStorage.getItem("theme");

    // Set initial switch state based on localStorage
    if (currentTheme === "light") {
        themeToggle.checked = true;
        document.body.classList.add("light-theme"); // <- THIS WAS THE MISSING LINE
    }

    // Listen for theme changes
    themeToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
            document.body.classList.add("light-theme");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.remove("light-theme");
            localStorage.setItem("theme", "dark");
        }
    });

    // 3. Logout Logic
    document.getElementById("logout-btn").addEventListener("click", () => {
        // Clear JWT tokens
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        
        // Redirect to login
        window.location.replace("/login-page/");
    });

    // 4. Fetch and Calculate Metrics
    await fetchMetrics();
});

async function fetchMetrics() {
    try {
        // We reuse the existing userbooks endpoint to calculate metrics
        const response = await apiFetch("/userbooks/");
        if (!response.ok) throw new Error("Failed to fetch books");
        
        const books = await response.json();
        
        const total = books.length;
        const finished = books.filter(b => b.status === "READ").length;
        const reading = books.filter(b => b.status === "READING").length;

        // Animate the numbers counting up for a premium feel
        animateValue("stat-total", 0, total, 1000);
        animateValue("stat-read", 0, finished, 1000);
        animateValue("stat-reading", 0, reading, 1000);

    } catch (error) {
        console.error("Error fetching metrics:", error);
    }
}

// Helper to make numbers count up beautifully
function animateValue(id, start, end, duration) {
    if (start === end) {
        document.getElementById(id).textContent = end;
        return;
    }
    let current = start;
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    
    const timer = setInterval(() => {
        current += increment;
        obj.textContent = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}