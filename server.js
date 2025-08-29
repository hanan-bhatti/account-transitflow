// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Serve static files from /public no matter what the route is
app.use(express.static(path.join(__dirname, "public")));

// ✅ Always normalize trailing slashes (so /account/ works like /account)
app.use((req, res, next) => {
  if (req.path.endsWith("/") && req.path !== "/") {
    res.redirect(req.path.slice(0, -1));
  } else {
    next();
  }
});

// ✅ Account routes (single-page)
app.get("/account*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "account.html"));
});

// ✅ Auth routes
app.get(
  [
    "/login",
    "/register",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/2fa",
    "/backup-code",
  ],
  (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
);

// ✅ Other static pages
app.get("/confirm-deletion", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "delete.html"));
});

app.get("/privacy-terms", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy-terms.html"));
});

app.get("/auth/verify-device", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "verify-device.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

// ✅ Default 404 for unknown routes (must come LAST)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
