import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Navbar } from "../../../component/Navbar"

export const SignUp = () => {
    // ─── State ────────────────────────────────────────────────────────────
    const [step, setStep] = useState("form") // "form" -> "otp"
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [otp, setOtp] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [info, setInfo] = useState("")
    const [cooldown, setCooldown] = useState(0)

    const navigate = useNavigate()

    // Hitung mundur tombol "Kirim ulang"
    useEffect(() => {
        if (cooldown <= 0) return
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
        return () => clearTimeout(t)
    }, [cooldown])

    const post = async (url, body) => {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const data = await response.json()
        return { ok: response.ok, data }
    }

    // ─── Langkah 1: kirim data pendaftaran, server mengirim OTP ───────────
    const handleSignUp = async (e) => {
        e.preventDefault()
        setError("")
        setInfo("")

        if (password !== confirm) {
            setError("Konfirmasi password tidak sama")
            return
        }

        setLoading(true)
        try {
            const { ok, data } = await post("/api/signup", { name, email, password })
            if (!ok) {
                setError(data.message || "Pendaftaran gagal. Coba lagi.")
                return
            }
            setEmail(data.email)
            setOtp("")
            setCooldown(60)
            setInfo(data.message)
            setStep("otp")
        } catch {
            setError("Tidak dapat terhubung ke server. Pastikan server berjalan.")
        } finally {
            setLoading(false)
        }
    }

    // ─── Langkah 2: verifikasi OTP, lalu otomatis login ───────────────────
    const handleVerify = async (e) => {
        e.preventDefault()
        setError("")
        setInfo("")
        setLoading(true)
        try {
            const { ok, data } = await post("/api/verify-otp", { email, otp })
            if (!ok) {
                setError(data.message || "Verifikasi gagal. Coba lagi.")
                return
            }
            sessionStorage.setItem("token", data.token)
            sessionStorage.setItem("user", JSON.stringify(data.user))
            navigate("/DocumentationPage")
        } catch {
            setError("Tidak dapat terhubung ke server. Pastikan server berjalan.")
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        setError("")
        setInfo("")
        try {
            const { ok, data } = await post("/api/resend-otp", { email })
            if (!ok) {
                setError(data.message || "Gagal mengirim ulang kode.")
                if (data.retryAfterSeconds) setCooldown(data.retryAfterSeconds)
                return
            }
            setCooldown(60)
            setInfo(data.message)
        } catch {
            setError("Tidak dapat terhubung ke server. Pastikan server berjalan.")
        }
    }

    const backToForm = () => {
        setStep("form")
        setError("")
        setInfo("")
    }

    const alerts = (
        <>
            {error && (
                <div className="alert alert-danger py-2 text-center small" role="alert">
                    {error}
                </div>
            )}
            {info && (
                <div className="alert alert-success py-2 text-center small" role="status">
                    {info}
                </div>
            )}
        </>
    )

    // ─── Tampilan langkah OTP ─────────────────────────────────────────────
    if (step === "otp") {
        return (<>
        <Navbar/>
        <div
      className="container d-flex justify-content-center align-items-center"
      style={{ minHeight: "100vh" }}
    >
      <div
        className="card shadow border-0"
        style={{ maxWidth: 480, width: "100%" }}
      >
        <div className="card-body p-5">
          <h2 className="text-center fw-bold text-dark mb-3">
            <i className="fa-solid fa-shield-halved" /> Verifikasi OTP
          </h2>
          <p className="text-center text-muted mb-4">
            Masukkan 6 digit kode yang dikirim ke <strong>{email}</strong>
          </p>
          {alerts}
          <form onSubmit={handleVerify}>
            <div className="mb-3">
              <label className="form-label">Kode OTP</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="form-control border-dark text-center fs-4"
                placeholder="------"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button
              type="submit"
              className="btn btn-dark w-100 mb-3"
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Memproses..." : "Verifikasi"}
            </button>
            <button
              type="button"
              className="btn btn-outline-dark w-100 mb-3"
              onClick={handleResend}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Kirim ulang kode (${cooldown}s)` : "Kirim ulang kode"}
            </button>
            <hr />
            <p className="text-center small mb-0">
              <button
                type="button"
                className="btn btn-link text-dark fw-bold text-decoration-none p-0"
                onClick={backToForm}
              >
                Ubah data pendaftaran
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
        </>)
    }

    // ─── Tampilan form pendaftaran (tampilan asli, kini terhubung ke API) ─
    return (<>
    <Navbar/>
    <div
  className="container d-flex justify-content-center align-items-center"
  style={{ minHeight: "100vh" }}
>
  <div
    className="card shadow border-0"
    style={{ maxWidth: 480, width: "100%" }}
  >
    <div className="card-body p-5">
      <h2 className="text-center fw-bold text-dark mb-3">
        <i className="fa-solid fa-user-plus" /> Sign Up
      </h2>
      <p className="text-center text-muted mb-4">Buat akun baru</p>
      {alerts}
      <form onSubmit={handleSignUp}>
        <div className="mb-3">
          <label className="form-label">Nama Lengkap</label>
          <input
            type="text"
            className="form-control border-dark"
            placeholder="Nama lengkap"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control border-dark"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control border-dark"
            placeholder="Password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Konfirmasi Password</label>
          <input
            type="password"
            className="form-control border-dark"
            placeholder="Ulangi password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-dark w-100 mb-3" disabled={loading}>
          {loading ? "Memproses..." : "Daftar"}
        </button>
        <hr />
        <p className="text-center small mb-0">{" "}
          Sudah punya akun?
       
          <Link to='/Login' className="text-dark fw-bold text-decoration-none">Login</Link>
        </p>
      </form>
    </div>
  </div>
</div>

    </>)
}
