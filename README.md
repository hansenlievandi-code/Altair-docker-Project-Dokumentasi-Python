# Altair-docker-Project-Dokumentasi-Python
Project "Website Dokumentasi Python" oleh tim Altair dari Universitas Mikroskil adalah sebuah platform pembelajaran digital yang dirancang menggunakan React Vite untuk menyajikan materi pemrograman Python secara modern, sistematis, dan interaktif. didukung oleh container project dari docker

# Altair Docs (Proyek UTS Container)

Platform dokumentasi Python (React + Vite) dengan backend Express untuk login.
Dikemas dalam satu container: Express menyajikan hasil build React sekaligus API.

Tim: Laurencio Luckson, Fendy, Aelberth Cheong

## Halaman dan endpoint
| URL | Keterangan |
|---|---|
| `/` | Halaman utama |
| `/DocumentationPage` | Halaman dokumentasi (juga `/OOP`, `/Fungsi`, dst.) |
| `/Login` | Halaman login |
| `/api/health` | Health check |
| `/api/info` | Info aplikasi (membaca `APP_NAME`, menampilkan hostname container) |
| `POST /api/login`, `GET /api/me` | Autentikasi JWT |

## Environment variable
| Nama | Default | Keterangan |
|---|---|---|
| `PORT` | `5000` | Port di dalam container |
| `APP_NAME` | `Altair Docs` | Tampil di `/api/info` |
| `APP_ENV` | `production` | Label environment |
| `JWT_SECRET` | acak saat start | **Rahasia**, kirim saat run |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | kosong | **Rahasia**, akun login demo. Kosong = login nonaktif |

Tidak ada secret di dalam image. Semua rahasia diberikan saat `run`.

## Build dan run (Docker)
```bash
docker build -t altair-docs:1.0 .

docker run -d --name altair-docs -p 8080:5000 \
  -e APP_NAME="Altair Docs (Demo)" \
  -e JWT_SECRET="isi_string_acak_panjang" \
  -e DEMO_EMAIL="laurencio@example.com" \
  -e DEMO_PASSWORD="isi_password_demo" \
  altair-docs:1.0
```
Buka http://localhost:8080 . Atur variabel dengan file: `--env-file .env`.

### Podman
Ganti `docker` dengan `podman` (perintah identik). Podman otomatis membaca `Dockerfile`.

## Perintah operasional
```bash
docker logs -f altair-docs        # lihat log request
docker inspect altair-docs        # detail container
docker exec -it altair-docs sh    # masuk ke container (cek: whoami -> node)
docker stop altair-docs
docker start altair-docs
docker rm -f altair-docs
```

## Tag dan push ke registry
```bash
docker login
docker tag altair-docs:1.0 USERNAME/altair-docs:1.0
docker push USERNAME/altair-docs:1.0
```

## Uji dari registry
```bash
docker rm -f altair-docs
docker rmi USERNAME/altair-docs:1.0 altair-docs:1.0
docker images                        # pastikan image hilang
docker pull USERNAME/altair-docs:1.0
docker run -d --name altair-docs -p 8080:5000 \
  -e JWT_SECRET="..." -e DEMO_EMAIL="..." -e DEMO_PASSWORD="..." \
  USERNAME/altair-docs:1.0
curl http://localhost:8080/api/info
```

## Pengembangan lokal (tanpa container)
```bash
npm install
DEMO_EMAIL=a@b.id DEMO_PASSWORD=rahasia npm run server   # terminal 1 (port 5000)
npm run dev                                              # terminal 2 (port 5173, /api di-proxy)
```
