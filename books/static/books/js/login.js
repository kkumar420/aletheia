// --- Password Cache Guard ---
// Clears the password field whenever the page is visited or restored from BFCache
window.addEventListener("pageshow", function(e) {
    const passwordInput = document.getElementById("password");
    if (passwordInput) passwordInput.value = "";
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    // If already authenticated, skip login and go straight to dashboard
    if (localStorage.getItem("access")) {
        window.location.replace("/api/");
        return;
    }

    // 1. DOM Elements
    const form = document.getElementById("login-form");
    const errorMessage = document.getElementById("error-message");

    // 2. Form Submission Listener
    form.addEventListener("submit", async (event) => {
        // Prevent the browser from refreshing the page (default form behavior)
        event.preventDefault();

        // Reset the error message visibility on each new attempt
        errorMessage.style.display = "none";

        // Extract and clean the user inputs
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        try {
            // 3. API Request
            // Send the credentials to your Django backend's token endpoint
            const response = await fetch("/api/token/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            // Parse the JSON response from the server
            const data = await response.json();

            // 4. Success Handling
            if (response.ok) {
                // Store the JWT tokens in the browser's local storage
                localStorage.setItem("access", data.access);
                localStorage.setItem("refresh", data.refresh);

                // Redirect the user to the main dashboard
                window.location.replace("/api/");
            } 
            // 5. Server Error Handling (e.g., wrong password)
            else {
                errorMessage.textContent = data.detail || "Login failed. Please check your credentials.";
                errorMessage.style.display = "block";
            }

        } catch (error) {
            // 6. Network Error Handling
            console.error("Login Error:", error);
            errorMessage.textContent = "Network error. Please try again later.";
            errorMessage.style.display = "block";
        }
    });
});