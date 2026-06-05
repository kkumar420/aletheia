function logout() {

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    window.location.href = "/api/login-page/";
}