# Catatan Demo dan Analisis (untuk video dan laporan)

## Fungsi dan arsitektur
- Fungsi: platform dokumentasi/tutorial Python dengan sidebar, tema gelap/terang, bookmark, diskusi, dan login.
- Arsitektur: 1 container, 1 proses Node.js (Express). Express menyajikan file statis hasil build React (`dist/`) dan API `/api/*`.
- Dependency runtime: express, bcryptjs, jsonwebtoken. React/Vite hanya dipakai saat build (tidak ikut image akhir).
- Port: 5000 di dalam container (dipetakan ke 8080 di host).

## Stateless vs stateful
- **Stateless (server):** tidak ada session dan tidak ada database. Autentikasi memakai JWT yang disimpan di browser, sehingga container bisa dihapus/dibuat ulang atau di-scale tanpa kehilangan data.
- **Stateful:** tidak ada di sisi container. Data per-pengguna (tema, bookmark, token login) hanya di `localStorage`/`sessionStorage` browser. Log mengalir ke stdout (`docker logs`).
- Konfigurasi dan rahasia masuk lewat environment variable, bukan di dalam image.

## Isi Dockerfile (3 stage)
1. `build`: `npm ci` lalu `npm run build` (Vite menghasilkan `dist/`).
2. `deps`: `npm ci --omit=dev` (hanya dependency runtime).
3. `runtime`: base `node:22-alpine`, salin `dist` + `node_modules` produksi + `server/`, `USER node` (non-root), `HEALTHCHECK`, `CMD node server/index.js`.

## Isi .dockerignore
`node_modules`, `dist`, `.git`, `.env*` (kecuali `.env.example`), log, dan file dokumentasi supaya build context kecil dan tidak ada secret yang masuk image.

## Urutan demo di video
1. Build: `docker build -t altair-docs:1.0 .` lalu `docker images` (tunjukkan ukuran).
2. Run dengan port mapping dan env var (lihat README), buka browser: `/`, `/DocumentationPage`, `/Login`.
3. `docker logs altair-docs` (log muncul setiap halaman dibuka).
4. `docker inspect altair-docs` (lihat Env dan port).
5. `docker exec -it altair-docs sh` lalu `whoami` (hasil: `node`), `env | grep APP_`.
6. `docker stop` lalu `docker start`, lalu `docker rm -f`.
7. Tag versi, `docker push`, tunjukkan halaman repo di registry.
8. Hapus image lokal, `docker pull`, `docker run`, buka browser dan buktikan jalan.
