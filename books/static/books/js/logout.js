function logout() {
    // 1. Destroy all auth tokens from localStorage
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    // 2. Use replace() instead of href so the login page replaces the current
    //    history entry — pressing "Back" can't return to the protected page
    window.location.replace("/api/login-page/");
}