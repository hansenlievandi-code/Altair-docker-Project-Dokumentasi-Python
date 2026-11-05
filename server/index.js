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

// Pengaturan OTP (opsional: SMTP untuk kirim email; tanpa SMTP, OTP dicetak ke log container)
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "no-reply@altair-docs.local";
const OTP_TTL_MS = (Number(process.env.OTP_TTL_MINUTES) || 5) * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("[WARN] JWT_SECRET tidak diset, memakai secret acak (token hilang saat restart).");
}

// User demo dibuat saat start dari env var, jadi image tidak berisi password/hash.
const users = [];
let nextUserId = 2;
// Pendaftaran yang menunggu verifikasi OTP (in-memory, tanpa database)
const pendingSignups = new Map();
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
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms ip=${req.ip}`
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
    return res.status(403).json({ success: false, message: "Token tidak valid atau sudah kadaluarsa" });
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
    return res.status(503).json({ success: false, message: "Login belum dikonfigurasi di server" });
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

// ─── Sign Up + OTP ───────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashOtp = (email, otp) =>
  crypto.createHmac("sha256", JWT_SECRET).update(`${email}:${otp}`).digest("hex");

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const sendOtpEmail = async (email, name, otp) => {
  const minutes = Math.round(OTP_TTL_MS / 60000);
  if (!SMTP_HOST) {
    // Tanpa SMTP: OTP muncul di log (docker logs) supaya tetap bisa diuji/didemokan.
    console.log(`[OTP] Kode verifikasi untuk ${email}: ${otp} (berlaku ${minutes} menit)`);
    return;
  }
  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: `"${APP_NAME}" <${SMTP_FROM}>`,
    to: email,
    subject: `Kode verifikasi ${APP_NAME}`,
    text: `Halo ${name},\n\nKode verifikasi Anda: ${otp}\nKode berlaku ${minutes} menit. Jangan bagikan kode ini kepada siapa pun.`,
  });
};

const issueToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

// Bersihkan pendaftaran kedaluwarsa agar memori tidak menumpuk
setInterval(() => {
  const now = Date.now();
  for (const [email, p] of pendingSignups) {
    if (p.expiresAt + 60 * 60 * 1000 < now) pendingSignups.delete(email);
  }
}, 10 * 60 * 1000).unref();

app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").toLowerCase().trim();
  const pass = String(password || "");

  if (!cleanName || !cleanEmail || !pass) {
    return res.status(400).json({ success: false, message: "Nama, email, dan password wajib diisi" });
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: "Format email tidak valid" });
  }
  if (pass.length < 6) {
    return res.status(400).json({ success: false, message: "Password minimal 6 karakter" });
  }
  if (users.some((u) => u.email === cleanEmail)) {
    return res.status(409).json({ success: false, message: "Email sudah terdaftar" });
  }

  const otp = generateOtp();
  pendingSignups.set(cleanEmail, {
    name: cleanName,
    password: bcrypt.hashSync(pass, 10),
    otpHash: hashOtp(cleanEmail, otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    lastSentAt: Date.now(),
    attempts: 0,
  });

  try {
    await sendOtpEmail(cleanEmail, cleanName, otp);
  } catch (err) {
    pendingSignups.delete(cleanEmail);
    console.error("[ERROR] Gagal mengirim OTP:", err.message);
    return res.status(502).json({ success: false, message: "Gagal mengirim kode OTP. Coba lagi nanti." });
  }
  res.status(201).json({
    success: true,
    message: "Kode OTP telah dikirim ke email Anda",
    email: cleanEmail,
    expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
  });
});

app.post("/api/verify-otp", (req, res) => {
  const cleanEmail = String((req.body || {}).email || "").toLowerCase().trim();
  const otp = String((req.body || {}).otp || "").trim();

  if (!cleanEmail || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: "Masukkan 6 digit kode OTP" });
  }
  const pending = pendingSignups.get(cleanEmail);
  if (!pending) {
    return res.status(404).json({ success: false, message: "Tidak ada pendaftaran untuk email ini. Silakan daftar ulang" });
  }
  if (Date.now() > pending.expiresAt) {
    pendingSignups.delete(cleanEmail);
    return res.status(410).json({ success: false, message: "Kode OTP kedaluwarsa. Kirim ulang kode" });
  }
  if (pending.attempts >= OTP_MAX_ATTEMPTS) {
    pendingSignups.delete(cleanEmail);
    return res.status(429).json({ success: false, message: "Terlalu banyak percobaan. Silakan daftar ulang" });
  }

  const given = Buffer.from(hashOtp(cleanEmail, otp));
  const expected = Buffer.from(pending.otpHash);
  if (!crypto.timingSafeEqual(given, expected)) {
    pending.attempts += 1;
    const left = OTP_MAX_ATTEMPTS - pending.attempts;
    return res.status(400).json({ success: false, message: `Kode OTP salah. Sisa percobaan: ${left}` });
  }

  if (users.some((u) => u.email === cleanEmail)) {
    pendingSignups.delete(cleanEmail);
    return res.status(409).json({ success: false, message: "Email sudah terdaftar" });
  }
  const user = { id: nextUserId++, name: pending.name, email: cleanEmail, password: pending.password };
  users.push(user);
  pendingSignups.delete(cleanEmail);

  res.json({
    success: true,
    message: "Verifikasi berhasil, akun Anda sudah aktif",
    token: issueToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.post("/api/resend-otp", async (req, res) => {
  const cleanEmail = String((req.body || {}).email || "").toLowerCase().trim();
  const pending = pendingSignups.get(cleanEmail);
  if (!pending) {
    return res.status(404).json({ success: false, message: "Tidak ada pendaftaran untuk email ini. Silakan daftar ulang" });
  }
  const wait = pending.lastSentAt + OTP_RESEND_MS - Date.now();
  if (wait > 0) {
    return res.status(429).json({
      success: false,
      message: `Tunggu ${Math.ceil(wait / 1000)} detik sebelum kirim ulang`,
      retryAfterSeconds: Math.ceil(wait / 1000),
    });
  }

  const otp = generateOtp();
  pending.otpHash = hashOtp(cleanEmail, otp);
  pending.expiresAt = Date.now() + OTP_TTL_MS;
  pending.lastSentAt = Date.now();
  pending.attempts = 0;
  try {
    await sendOtpEmail(cleanEmail, pending.name, otp);
  } catch (err) {
    console.error("[ERROR] Gagal mengirim OTP:", err.message);
    return res.status(502).json({ success: false, message: "Gagal mengirim kode OTP. Coba lagi nanti." });
  }
  res.json({ success: true, message: "Kode OTP baru telah dikirim", expiresInSeconds: Math.round(OTP_TTL_MS / 1000) });
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
