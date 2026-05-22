window.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    try {
      const response = await fetch("/api/auth/me");

      if (response.ok) {
        location.href = "/home";
      } else {
        location.href = "/login.html";
      }
    } catch {
      location.href = "/login.html";
    }
  }, 1800);
});