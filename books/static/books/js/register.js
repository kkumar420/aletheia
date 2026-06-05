// --- Password Cache Guard ---
// Clears password fields whenever the page is restored from BFCache
window.addEventListener("pageshow", function(e) {
    const pw = document.getElementById("reg-password");
    const confirm = document.getElementById("reg-confirm");
    if (pw) pw.value = "";
    if (confirm) confirm.value = "";
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    // If already authenticated, skip registration and go straight to dashboard
    if (localStorage.getItem("access")) {
        window.location.replace("/api/");
        return;
    }

    const form = document.getElementById("register-form");
    const errorMessage = document.getElementById("error-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorMessage.style.display = "none";

        const username = document.getElementById("reg-username").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById("reg-confirm").value;

        // --- Client-side validation ---
        if (password !== confirmPassword) {
            errorMessage.textContent = "Passwords do not match.";
            errorMessage.style.display = "block";
            return;
        }

        if (password.length < 8) {
            errorMessage.textContent = "Password must be at least 8 characters.";
            errorMessage.style.display = "block";
            return;
        }

        // UI feedback
        const submitBtn = document.getElementById("register-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating account...";

        try {
            // 1. Register the user via the DRF endpoint
            const registerResponse = await fetch("/api/register/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const registerData = await registerResponse.json();

            if (!registerResponse.ok) {
                // Parse DRF validation errors into readable messages
                const errorMsg = parseDRFErrors(registerData);
                throw new Error(errorMsg);
            }

            // 2. Auto-login: immediately obtain JWT tokens with the new credentials
            const tokenResponse = await fetch("/api/token/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json();
                localStorage.setItem("access", tokenData.access);
                localStorage.setItem("refresh", tokenData.refresh);

                // Go straight to the dashboard — no detour through login
                window.location.replace("/api/");
            } else {
                // Account created but auto-login failed — send them to login page
                window.location.replace("/api/login-page/");
            }

        } catch (error) {
            console.error("Registration error:", error);
            errorMessage.textContent = error.message || "Registration failed. Please try again.";
            errorMessage.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
        }
    });
});

// --- DRF Error Parser ---
// Converts DRF's nested error format { "field": ["msg1", "msg2"] } into a single readable string
function parseDRFErrors(errorData) {
    if (typeof errorData === "string") return errorData;
    
    const messages = [];
    for (const field in errorData) {
        const fieldErrors = errorData[field];
        if (Array.isArray(fieldErrors)) {
            fieldErrors.forEach(msg => {
                // Capitalize the field name for display
                const label = field.charAt(0).toUpperCase() + field.slice(1);
                messages.push(`${label}: ${msg}`);
            });
        } else if (typeof fieldErrors === "string") {
            messages.push(fieldErrors);
        }
    }
    return messages.join(" ") || "Registration failed.";
}
