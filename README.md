# Mini-Project 1: VKU Field Survey — Offline Data Collection (PWA & Capacitor)

> **Môn học:** Cross-Platform Mobile & Web Development  
> **Thời lượng:** Tuần 3 - 4 | **Trọng số:** 10%  
> **Mục tiêu:** Xây dựng ứng dụng PWA Offline-First phục vụ kiểm tra, khảo sát cơ sở vật chất khuôn viên Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU), đóng gói thành ứng dụng Android Native APK qua Capacitor.

---

## 📦 Bộ 3 Sản phẩm Bàn giao Bắt buộc (Mandatory Deliverables)

### 1. 🌐 Live Demo URL
- **Nền tảng:** Cloudflare Pages (HTTPS bắt buộc).
- **Endpoint API Sync thật:** Tích hợp sẵn Cloudflare Serverless Function tại `functions/api/submissions.ts`.
- **Cách deploy:** Kết nối GitHub repo với Cloudflare Pages, Build command: `npm run build`, Build output: `dist`. Không cần cấu hình thêm backend bên ngoài.

### 2. 💻 GitHub Repository
- Mã nguồn TypeScript module hóa cao, kiến trúc Offline-First tiêu chuẩn.
- Hoạt động 100% khi mất mạng với Service Worker (Cache-First) và IndexedDB (`idb`).
- Đóng gói Android APK qua Capacitor Bridge (`@capacitor/camera`, `@capacitor/network`, định vị GPS).

### 3. 📄 Báo cáo Kỹ thuật Ngắn (Short Report - 2 đến 4 trang PDF)
Báo cáo theo mẫu chuẩn gồm:
1. **Feature Checklist:** Bảng kiểm tính năng (PWA standalone, Cache-First SW, Form 3 bước, IndexedDB draft recovery, Offline sync queue, Capacitor APK).
2. **Architecture Diagram:** Sơ đồ luồng dữ liệu Offline-First (UI → IndexedDB → SW/Window Online → Serverless API).
3. **Screenshots:** Ảnh chụp màn hình kiểm tra thực tế (Online, Offline draft lưu trữ, Chụp ảnh nén hiện trạng, Lịch sử đồng bộ, Xuất báo cáo CSV).

---

## 🚀 Tính năng Cốt lõi (Core Specifications)

| Tính năng | Mô tả chi tiết & Hiện trạng |
|---|---|
| **PWA Standalone** | `manifest.json` chuẩn `display: standalone`, theme color `#0284c7`, icon 192x192 & 512x512, cài đặt mượt mà trên Android/iOS/Desktop. |
| **Cache-First SW** | Service Worker thuần không phụ thuộc thư viện ngoài, cache toàn bộ App Shell (HTML, CSS, JS, Google Fonts), khởi động sub-second ngay cả khi ngắt kết nối mạng. |
| **Form kiểm tra 3 bước** | Khảo sát Tòa nhà (Khu V, K, A, B, C, KTX), Tầng, Phòng, Danh mục (Hardware, Projector, AC, Electrical, Furniture), Đánh giá 1-5 sao, Ghi chú, Ảnh hiện trạng và Tọa độ GPS. |
| **Gợi ý lỗi nhanh & Ưu tiên** | Tích chọn lỗi thường gặp trong 1 giây (VD Điều hòa: *Không mát, Chảy nước, Hỏng remote...*), gắn cờ mức độ ưu tiên (`Bình thường`, `Cần xử lý`, `Khẩn cấp`). |
| **Nén ảnh tự động (Canvas)** | Nén ảnh chụp từ 3-8MB xuống ~250KB JPEG, đảm bảo ghi IndexedDB tức thì và upload siêu nhanh, không tràn RAM thiết bị. |
| **Lưu nháp thời gian thực** | Mọi thay đổi trên form được tự động lưu vào IndexedDB store `draft`. F5 hoặc đóng trình duyệt mở lại giữ nguyên trạng thái. |
| **Hàng đợi Sync tuần tự** | Bản ghi offline được cấp UUID, timestamp và lưu trạng thái `PENDING_SYNC`. Khi có mạng, tự động dispatch tuần tự qua Background Sync API hoặc `window.online`. |
| **Lịch sử & Xuất báo cáo** | Dashboard KPI 4 thẻ, bộ lọc tìm kiếm, xem ảnh phóng to (Lightbox), nút "Đồng bộ ngay" và nút "Xuất file CSV/Excel" UTF-8 có dấu. |
| **Capacitor Android APK** | Tích hợp Camera, Network status, biên dịch thành công file APK cho thiết bị di động. |

---

## 🏗️ Cấu trúc Thư mục (Modular Architecture)

```
vku-field-survey/
├── functions/
│   └── api/
│       └── submissions.ts    ← Cloudflare Pages Serverless Function (Production Sync API)
├── public/
│   ├── sw.js                 ← Service Worker (Cache-First + Background Sync)
│   ├── manifest.json         ← PWA manifest standalone
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.ts               ← App bootstrap, SW registration, Network listener
│   ├── style.css             ← VKU Design System (Glassmorphism & animations)
│   ├── db/
│   │   └── index.ts          ← IndexedDB layer (`idb`): submissions + draft store
│   ├── form/
│   │   ├── steps.ts          ← Form kiểm tra 3 bước + Tag lỗi nhanh + GPS
│   │   ├── camera.ts         ← Chụp ảnh (Capacitor/Web) + Canvas compression
│   │   └── history.ts        ← Danh sách lịch sử, KPI dashboard, CSV export
│   ├── sync/
│   │   └── index.ts          ← Hàng đợi đồng bộ tuần tự + Background Sync
│   └── utils/
│       ├── geo.ts            ← Helper định vị tọa độ GPS khuôn viên VKU
│       └── toast.ts          ← Hệ thống Toast notification thông minh
├── capacitor.config.ts       ← Cấu hình Capacitor Android
├── vite.config.ts            ← Cấu hình Vite & Dev API middleware
├── tsconfig.json
└── _redirects                ← Cloudflare Pages SPA routing
```

---

## 🛠️ Hướng dẫn Khởi chạy & Phát triển

### 1. Yêu cầu Môi trường
- Node.js ≥ 20
- npm ≥ 9
- Android Studio & JDK 17+ (đối với build APK)

### 2. Chạy Web Development
```bash
# 1. Cài đặt thư viện
npm install

# 2. Tạo file cấu hình môi trường
copy .env.example .env

# 3. Khởi chạy Vite Dev Server
npm run dev
```
Truy cập: **`http://localhost:5173/`**

> **Ghi chú về API:** Khi chạy `npm run dev`, Vite Dev Server đã tích hợp sẵn API `/api/submissions`, tự động phản hồi `200 OK` giả lập đồng bộ máy chủ thật, không còn bị lỗi proxy `ECONNREFUSED`.

---

## 🌐 Triển khai Live Demo lên Cloudflare Pages

1. Đẩy mã nguồn lên kho chứa GitHub công khai.
2. Đăng nhập [Cloudflare Pages](https://pages.cloudflare.com/) → Nhấn **Create a project** → **Connect to Git**.
3. Chọn repository và cấu hình thông số build:
   - **Framework preset:** `None / Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `20`
4. Nhấn **Save and Deploy**. Cloudflare Pages sẽ tự động nhận diện thư mục `functions/api/submissions.ts` và tạo API serverless HTTPS trực tiếp.

---

## 📱 Đóng gói Ứng dụng Android APK (Capacitor)

```bash
# 1. Build mã nguồn web ra dist/
npm run build

# 2. Thêm nền tảng Android (chỉ cần chạy lần đầu)
npm run cap:add:android

# 3. Đồng bộ code web vào project Android
npm run cap:sync

# 4. Mở Android Studio để cắm máy chạy thử hoặc xuất APK
npm run cap:open
```

Trong Android Studio:
- Chọn **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
- File APK xuất ra tại: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📊 Sơ đồ Luồng Hoạt động Offline-First

```
[Kiểm tra viên nhập Form 3 bước]
        │
        ├── (Lưu nháp sau mỗi thay đổi) ──────► [IndexedDB: Store "draft"]
        │                                             │
        │                                       (Khôi phục khi mở lại app)
        ▼ (Nhấn "Lưu & Gửi báo cáo")
[IndexedDB: Store "submissions"] ◄── (Gán UUID, Timestamp, PENDING_SYNC)
        │
        ▼
[Sync Engine (src/sync/index.ts)]
        │
        ├── Đang Offline? ──► Tạm dừng, đăng ký Service Worker Background Sync Tag
        │
        └── Đang Online?  ──► Gửi tuần tự (for...of + await) lên API
                                  │
                                  ▼
                     [POST /api/submissions]
                     (Cloudflare Pages Function / Dev API)
                                  │
                                  ▼ (Nhận HTTP 200)
                     [Cập nhật status: SYNCED trong IndexedDB]
                                  │
                                  ▼
                     [Live Update Badge & KPI Dashboard]
```

---

## 📋 Hướng dẫn Chuẩn bị Báo cáo Ngắn (2-4 trang PDF)

Khi biên soạn báo cáo nộp bài, bạn có thể cấu trúc như sau:
1. **Trang 1 — Giới thiệu & Bảng kiểm tính năng (Checklist):**
   - Đặt vấn đề: Kiểm tra phòng học VKU ở tầng hầm, phòng kín mất sóng 4G/Wi-Fi.
   - Bảng Checklist các tính năng hoàn thành 100%.
2. **Trang 2 — Kiến trúc Hệ thống & Cơ chế Offline-First:**
   - Đưa sơ đồ luồng dữ liệu ở trên vào báo cáo.
   - Giải thích cơ chế Cache-First của Service Worker, lưu trữ IndexedDB và nén ảnh Canvas.
3. **Trang 3 & 4 — Ảnh chụp Màn hình Thực nghiệm (Screenshots):**
   - Ảnh 1: Ứng dụng cài đặt dạng PWA Standalone trên điện thoại hoặc desktop.
   - Ảnh 2: Form 3 bước (chọn phòng VKU, tag lỗi nhanh, định vị GPS, đánh giá sao, chụp ảnh).
   - Ảnh 3: Test Offline (Tắt mạng → Gửi báo cáo → Bản ghi lưu ở trạng thái `Chờ đồng bộ`).
   - Ảnh 4: Test Tự động Sync (Bật mạng lại → Tự động đồng bộ lên server → Chuyển sang `Đã đồng bộ` và xuất file Excel/CSV).
   - Ảnh 5: Ứng dụng chạy trên thiết bị Android qua file APK build từ Capacitor.

---

## 📜 Giấy phép

Đồ án Mini-Project #1 — Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU), Đại học Đà Nẵng.
