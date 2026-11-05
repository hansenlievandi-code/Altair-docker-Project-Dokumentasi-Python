import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const docs = [
  "DocumentationPage","Comprehension","Debugging","Decorator","errorHandeling",
  "file_io","Fungsi","Kondisi","modulePackage","OOP",
  "Operator","pengenalanPython","Perulangan","StandardLibary","String",
  "strukturData","Testing","typeHints","VariabelTipeData","virtualEnvPip",
];

// Ambil data user yang tersimpan saat login (localStorage = "ingat saya", sessionStorage = sesi biasa)
const readSession = () => {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const token = storage.getItem("token");
      const user = JSON.parse(storage.getItem("user") || "null");
      if (token && user) return { token, user, storage };
    } catch {
      /* data rusak, abaikan */
    }
  }
  return null;
};

export const Navbar = () => {
  const [theme, setTheme] = useState("light");
  const [session, setSession] = useState(readSession);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();

  /* THEME */
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "light";
    setTheme(saved);
    document.body.className = saved;
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.body.className = next;
  };

  /* PROFILE: pastikan token masih valid (mis. server restart), jika tidak, anggap belum login */
  useEffect(() => {
    if (!session) return;
    fetch("/api/me", { headers: { Authorization: `Bearer ${session.token}` } })
      .then((res) => {
        if (res.status === 401 || res.status === 403) handleLogout(false);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = (callApi = true) => {
    if (session && callApi) {
      fetch("/api/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setSession(null);
    if (callApi) navigate("/Login");
  };

  /* SEARCH */
  const handleChange = (value) => {
    setQuery(value);
    if (!value.trim()) return setSuggestions([]);
    setSuggestions(
      docs.filter(d => d.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSuggestions([]);
    navigate(`/${query}`);
  };

  const selectSuggestion = (text) => {
    setQuery(text);
    setSuggestions([]);
    navigate(`/${text}`);
  };

  return (
    <nav className="navbar navbar-expand-lg shadow-sm sticky-top">
      <div className="container-fluid px-4">
        <Link className="navbar-brand fw-bold fs-2" to="/">Altair</Link>

        <div className="search-container position-relative" style={{ marginRight: "-280px" }}>
          <form className="d-flex" onSubmit={handleSubmit}>
            <input
              className="form-control me-2"
              type="search"
              placeholder="Cari dokumentasi..."
              value={query}
              onChange={e => handleChange(e.target.value)}
            />
            <button className="btn btn-outline-secondary" type="submit">Search</button>
          </form>

          {suggestions.length > 0 && (
            <div className="position-absolute w-100 shadow rounded mt-1 search-suggest">
              {suggestions.map((item, i) => (
                <div
                  key={i}
                  className="px-3 py-2 suggestion-item"
                  onClick={() => selectSuggestion(item)}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-4">
          <Link className="nav-link" to="/">Home</Link>
          <div className="dropdown">
            <button
              className="btn btn-light dropdown-toggle fw-medium"
              type="button"
              data-bs-toggle="dropdown"
            >
              About
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow-sm">
              <li>
                <Link className="dropdown-item" to="/policy">
                  Policy
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/about">
                  This Website
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/rating">
                  Rating
                </Link>
              </li>
            </ul>
          </div>
          <button onClick={toggleTheme} className="btn btn-outline-secondary">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {session ? (
            <div className="dropdown">
              <button
                className="btn btn-light d-flex align-items-center gap-2 dropdown-toggle fw-medium"
                type="button"
                data-bs-toggle="dropdown"
              >
                <span
                  className="rounded-circle bg-dark text-white d-inline-flex justify-content-center align-items-center fw-bold"
                  style={{ width: 32, height: 32 }}
                >
                  {(session.user.name || session.user.email || "?").charAt(0).toUpperCase()}
                </span>
                <span className="d-none d-md-inline">{session.user.name}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm" style={{ minWidth: 240 }}>
                <li className="px-3 py-2">
                  <div className="fw-bold">{session.user.name}</div>
                  <div className="small text-muted text-break">{session.user.email}</div>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger" type="button" onClick={() => handleLogout()}>
                    <i className="fa-solid fa-right-from-bracket me-2" />
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link to="/login" className="btn btn-dark px-4">Sign In / Sign Up</Link>
          )}
        </div>
      </div>
    </nav>
  );
};