import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");

// ─── Konfigurasi dari environment variable (tidak ada secret di dalam image) ──
const PORT = Number(process.env.PORT) || 5000;
const APP_NAME = process.env.APP_NAME || "Altair Docs";
const APP_ENV = process.env.APP_ENV || "production";
const DEMO_NAME = process.env.DEMO_NAME || "Demo User";
const DEMO_EMAIL = (process.env.DEMO_EMAIL || "").toLowerCase().trim();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "";

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    JWT_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn("[WARN] JWT_SECRET tidak diset, memakai secret acak (token hilang saat restart).");
}

// User demo dibuat saat start dari env var, jadi image tidak berisi password/hash.
const users = [];
if (DEMO_EMAIL && DEMO_PASSWORD) {
    users.push({
        id: 1,
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        password: bcrypt.hashSync(DEMO_PASSWORD, 10),
    });
} else {
    console.warn("[WARN] DEMO_EMAIL / DEMO_PASSWORD tidak diset, login dinonaktifkan.");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// ─── Log setiap request ──────────────────────────────────────────────────────
app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(
            `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${
                ms.toFixed(1)
            }ms ip=${req.ip}`,
        );
    });
    next();
});

// ─── Auth helper ─────────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
    const token = (req.headers["authorization"] || "").split(" ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Token tidak ditemukan" });
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({
            success: false,
            message: "Token tidak valid atau sudah kadaluarsa",
        });
    }
};

// ─── API ─────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

app.get("/api/info", (_req, res) => {
    res.json({
        app: APP_NAME,
        env: APP_ENV,
        port: PORT,
        hostname: os.hostname(), // = container ID saat jalan di container
        node: process.version,
        time: new Date().toISOString(),
    });
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email dan password wajib diisi" });
    }
    if (users.length === 0) {
        return res.status(503).json({
            success: false,
            message: "Login belum dikonfigurasi di server",
        });
    }

    const user = users.find((u) => u.email === String(email).toLowerCase().trim());
    const valid = user && (await bcrypt.compare(password, user.password));
    if (!valid) {
        return res.status(401).json({ success: false, message: "Email atau password salah" });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, {
        expiresIn: "7d",
    });
    res.json({
        success: true,
        message: "Login berhasil",
        token,
        user: { id: user.id, name: user.name, email: user.email },
    });
});

app.get("/api/me", verifyToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

app.post("/api/logout", verifyToken, (_req, res) => {
    res.json({ success: true, message: "Logout berhasil." });
});

app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// ─── Frontend (hasil build Vite) + fallback untuk React Router ───────────────
app.use(express.static(DIST_DIR));
app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`[START] ${APP_NAME} (${APP_ENV}) berjalan di port ${PORT}`);
});
