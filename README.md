# BÁO CÁO MINI-PROJECT 1
## MÔN HỌC: PHÁT TRIỂN ỨNG DỤNG ĐA NỀN TẢNG (CROSS-PLATFORM DEVELOPMENT)

---

### ĐỀ TÀI:
# VKU FIELD SURVEY — HỆ THỐNG KHẢO SÁT & KIỂM TRA CƠ SỞ VẬT CHẤT KHUÔN VIÊN VKU
### (ỨNG DỤNG OFFLINE-FIRST PWA & ĐÓNG GÓI NATIVE MOBILE APP VỚI CAPACITOR)

* **Cơ sở đào tạo:** Trường Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU) – Đại học Đà Nẵng
* **Khoa:** Khoa Khoa học Máy tính / Kỹ thuật Máy tính & Điện tử
* **Học phần:** Phát triển Ứng dụng Đa nền tảng (Cross-Platform Mobile & Web Development)
* **Mã nguồn GitHub:** [https://github.com/hungbbdzz/vku-field-survey](https://github.com/hungbbdzz/vku-field-survey)
* **Live Demo URL:** [https://vku-field-survey.hungabc2206.workers.dev/](https://vku-field-survey.hungabc2206.workers.dev/)

---

## MỤC LỤC
1. [GIỚI THIỆU ĐỀ TÀI & MỤC TIÊU](#1-giới-thiệu-đề-tài--mục-tiêu)
2. [BẢNG KIỂM TÍNH NĂNG HOÀN THÀNH (CHECKLIST)](#2-bảng-kiểm-tính-năng-hoàn-thành-checklist)
3. [KIẾN TRÚC HỆ THỐNG & CƠ CHẾ OFFLINE-FIRST](#3-kiến-trúc-hệ-thống--cơ-chế-offline-first)
4. [QUY TRÌNH ĐÓNG GÓI MOBILE APP QUA CAPACITOR](#4-quy-trình-đóng-gói-mobile-app-qua-capacitor)
5. [KỊCH BẢN KIỂM THỬ THỰC TẾ & KẾT QUẢ](#5-kịch-bản-kiểm-thử-thực-tế--kết-quả)
6. [HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH](#6-hướng-dẫn-cài-đặt--vận-hành)
7. [KẾT LUẬN & HƯỚNG PHÁT TRIỂN](#7-kết-luận--hướng-phát-triển)

---

## 1. GIỚI THIỆU ĐỀ TÀI & MỤC TIÊU

### 1.1. Đặt vấn đề thực tế
Tại khuôn viên Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn (VKU), công tác thanh tra, khảo sát hiện trạng trang thiết bị phòng học (máy chiếu, điều hòa, hệ thống mạng, bàn ghế, thiết bị điện) thường xuyên được thực hiện tại các khu vực: Khu giảng đường V, Khu K, Khu A, Khu B, Khu C và Khu Ký túc xá.

Tuy nhiên, cán bộ kiểm tra thường gặp phải các trở ngại kỹ thuật lớn:
1. **Vùng lõm sóng viễn thông (Dead Zones):** Tại các phòng thực hành máy tính kín, phòng máy chủ hoặc tầng hầm khu V, sóng di động 4G/5G và mạng Wi-Fi trường thường yếu hoặc mất kết nối hoàn toàn.
2. **Mất mát dữ liệu khi thao tác form web:** Các giải pháp web truyền thống (Google Forms, Web App thông thường) khi mất mạng sẽ làm mất trắng dữ liệu người dùng đang nhập dở dang hoặc báo lỗi upload ảnh thất bại.
3. **Dung lượng ảnh gốc quá lớn:** Ảnh chụp hiện trạng bằng camera điện thoại hiện nay có độ phân giải cao (3MB – 10MB/ảnh). Nếu không nén client-side, việc lưu trữ cục bộ sẽ nhanh chóng làm tràn bộ nhớ trình duyệt và gây nghẽn băng thông khi đồng bộ.

### 1.2. Mục tiêu giải pháp
Đề tài **VKU Field Survey** được xây dựng nhằm giải quyết triệt để các vấn đề trên với 3 trụ cột kỹ thuật:
- **Offline-First PWA:** Ứng dụng hoạt động độc lập không phụ thuộc Internet. Giao diện tải tức thì trong vòng < 0.5s thông qua Service Worker (Chiến lược **Cache-First**). Dữ liệu form nhập dở tự động lưu nháp thời gian thực vào **IndexedDB**.
- **Cơ chế Nén ảnh Canvas & Đồng bộ Tuần tự (Sequential Background Sync):** Ảnh chụp từ Camera được tự động nén trực tiếp trên trình duyệt xuống kích thước tối ưu (~200KB - 300KB), cấp phát UUID định danh và đưa vào hàng đợi `PENDING_SYNC` để đẩy lên máy chủ tuần tự khi thiết bị có mạng trở lại.
- **Đóng gói Native Mobile App qua Capacitor:** Chuyển đổi mã nguồn Web hiện có thành ứng dụng Android Native hoàn chỉnh (.APK), gọi trực tiếp các API phần cứng của hệ điều hành như Camera phần cứng và Bộ theo dõi trạng thái mạng Network Monitor.

---

## 2. BẢNG KIỂM TÍNH NĂNG HOÀN THÀNH (CHECKLIST)

| STT | Nhóm Tính năng | Chi tiết kỹ thuật đã cài đặt | Trạng thái | Đánh giá |
|:---:|---|---|:---:|:---:|
| **1** | **PWA Standalone** | `manifest.json` chuẩn W3C, `display: standalone`, theme color `#0284c7`, bộ icon 192x192 và 512x512; cài đặt mượt mà trên Android, iOS và Desktop. | Hoàn thành | 100% |
| **2** | **Cache-First Service Worker** | Service Worker thuần tối ưu hóa bộ nhớ đệm App Shell (HTML, CSS, JS, Google Fonts, SVG); khởi động không cần kết nối mạng. | Hoàn thành | 100% |
| **3** | **Form Khảo sát 3 bước** | Phân loại Tòa nhà VKU (V, K, A, B, C, KTX), Tầng, Phòng học; Danh mục thiết bị; Đánh giá chất lượng 1-5 sao; Ghi chú chi tiết; Định vị GPS khuôn viên VKU. | Hoàn thành | 100% |
| **4** | **Tag Lỗi Nhanh & Mức độ Ưu tiên** | Danh mục lỗi gợi ý chọn nhanh trong 1 click theo từng thiết bị (Điều hòa chảy nước/không mát; Máy chiếu mờ/không nhận tín hiệu...); Phân loại: *Bình thường, Cần xử lý, Khẩn cấp*. | Hoàn thành | 100% |
| **5** | **Xử lý Ảnh Client-Side** | Sử dụng HTML5 Canvas API nén ảnh chụp chất lượng cao về định dạng JPEG nén tỉ lệ 0.7, khống chế dung lượng < 300KB mà vẫn rõ nét tem nhãn và chi tiết hư hỏng. | Hoàn thành | 100% |
| **6** | **Tự động Lưu nháp (Draft Recovery)** | Mọi ký tự nhập vào form được lưu lập tức vào IndexedDB Object Store `draft`. Người dùng tắt trình duyệt, tải lại trang (F5) đều được phục hồi 100% dữ liệu. | Hoàn thành | 100% |
| **7** | **Hàng đợi Đồng bộ Tuần tự (Offline Sync Queue)** | Đánh dấu bản ghi `PENDING_SYNC` khi gửi offline. Khi mạng phục hồi, Sync Engine tự kích hoạt xử lý tuần tự từng bản ghi (dùng vòng lặp `for...of` + `await`) tránh nghẽn server. | Hoàn thành | 100% |
| **8** | **Dashboard & Xuất báo cáo** | Bảng điều khiển thống kê KPI (Tổng số phiếu, Chờ đồng bộ, Đã đồng bộ, Tỉ lệ hoàn tất), xem lại ảnh đính kèm (Lightbox), xuất toàn bộ báo cáo ra file CSV/Excel UTF-8 có dấu. | Hoàn thành | 100% |
| **9** | **Đóng gói Android APK (Capacitor)** | Tích hợp `@capacitor/core`, `@capacitor/camera`, `@capacitor/network`, `@capacitor/android`; build thành công gói APK native chạy độc lập trên điện thoại. | Hoàn thành | 100% |

---

## 3. KIẾN TRÚC HỆ THỐNG & CƠ CHẾ OFFLINE-FIRST

### 3.1. Sơ đồ Luồng Dữ liệu (Data Flow Architecture)

```
                       [KIỂM TRA VIÊN THAO TÁC FORM 3 BƯỚC]
                                      │
                 (Tự động lưu nháp sau mỗi thay đổi input)
                                      ▼
                        [IndexedDB: Store "draft"]
                                      │ (Phục hồi tức thì khi mở lại ứng dụng)
                                      │
                         [Bấm nút "Lưu & Gửi Báo Cáo"]
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
   [Xử lý Ảnh trên Canvas]                             [Lấy Tọa độ GPS]
   (Nén 5MB -> ~250KB JPEG)                       (navigator.geolocation)
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      ▼
             [Gán UUID v4 + Timestamp + Trạng thái: PENDING_SYNC]
                                      ▼
                     [Ghi vào IndexedDB: Store "submissions"]
                                      │
                     [Sync Engine (src/sync/index.ts)]
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
      [Trạng thái: OFFLINE]                         [Trạng thái: ONLINE]
               │                                             │
      • Lưu trữ an toàn tại client                  • Duyệt tuần tự hàng đợi
      • Hiển thị huy hiệu "Chờ đồng bộ"             • Gửi POST /api/submissions
      • Đăng ký Background Sync SW                  • Nhận HTTP 200 OK thành công
               │                                             │
               │ (Khi thiết bị có mạng trở lại)             ▼
               └────────────────────────────────────► [Cập nhật status: SYNCED]
                                                             │
                                                    [Cập nhật Live KPI Dashboard]
                                                    [Hiển thị Toast thông báo]
```

### 3.2. Chi tiết các thành phần công nghệ

#### A. Tầng Giao diện & Xây dựng (Frontend Presentation)
* **Vite 8 & TypeScript:** Thiết kế theo phong cách Module hóa cao, đảm bảo Type Safety, không phụ thuộc vào framework nặng nề (sử dụng Clean Vanilla DOM Architecture), giúp ứng dụng có dung lượng bundle siêu nhỏ (`main.js` chỉ ~89KB, `main.css` ~32KB).
* **VKU Modern Design System:** Giao diện tối ưu chuẩn trải nghiệm di động (Mobile-First UI), hiệu ứng Glassmorphism hiện đại, hỗ trợ Dark/Light Theme hài hòa, tương thích tốt trên màn hình cảm ứng từ 4.7 inch đến tablet.

#### B. Tầng Lưu trữ Cục bộ (Local Storage Layer — IndexedDB)
Sử dụng thư viện wrapper `idb` (v8.0.3) với cấu trúc 2 Object Stores chuyên biệt:
1. **Store `draft`:** Lưu trữ bản nháp tạm thời của form hiện tại (Key: `current_draft`). Tự động dọn dẹp khi người dùng gửi phiếu thành công.
2. **Store `submissions`:** Lưu trữ danh sách phiếu kiểm tra đầy đủ với Primary Key là `id` (UUID), tạo sẵn các Index:
   - `status`: Tra cứu nhanh danh sách `PENDING_SYNC` hoặc `SYNCED`.
   - `timestamp`: Sắp xếp dòng thời gian khảo sát từ mới nhất đến cũ nhất.
   - `building`: Hỗ trợ bộ lọc nhanh theo từng tòa nhà khuôn viên VKU.

#### C. Chiến lược Bộ nhớ đệm (Service Worker Cache-First)
Tệp [sw.js](file:///c:/Users/hunga/Documents/Materials/Cross_platform_dev/vku-field-survey/public/sw.js) được cấu hình theo chiến lược **Cache-First cho tài nguyên tĩnh (Static Assets)** và **Network-First/Fallback cho API**:
* Khi mở ứng dụng, Service Worker chặn các request tới App Shell (`/`, `index.html`, các tệp JS/CSS trong `assets/`, font chữ Inter) và trả về từ Cache ngay lập tức.
* Khi offline hoàn toàn, giao diện ứng dụng vẫn mở lên trong thời gian dưới 1 giây mà không gặp bất kỳ thông báo lỗi kết nối nào từ trình duyệt.

#### D. Thuật toán Xử lý & Nén ảnh (Client-side Compression)
Mã nguồn tại [src/form/camera.ts](file:///c:/Users/hunga/Documents/Materials/Cross_platform_dev/vku-field-survey/src/form/camera.ts) sử dụng phần tử `HTMLCanvasElement`:
* Đọc file ảnh gốc qua `FileReader` ➔ Tạo đối tượng `Image`.
* Tính toán tỉ lệ kích thước (giới hạn chiều rộng tối đa 1280px).
* Vẽ lại lên Canvas và trích xuất qua `canvas.toDataURL('image/jpeg', 0.7)`.
* Kết quả: Ảnh chụp từ camera điện thoại dung lượng gốc 4MB - 8MB được nén xuống chỉ còn **~150KB - 280KB**, giữ nguyên chất lượng hiển thị rõ ràng, giúp lưu trữ vào IndexedDB tức thì mà không gây nghẽn dung lượng.

---

## 4. QUY TRÌNH ĐÓNG GÓI MOBILE APP QUA CAPACITOR

### 4.1. Vai trò của Capacitor
Capacitor (phát triển bởi Ionic Team) đóng vai trò là cầu nối (Native Bridge) runtime hiện đại. Nó cho phép bọc mã nguồn Web PWA đã biên dịch (thư mục `dist`) vào trong một ứng dụng Android Studio Native thuần túy.

Khác với các công cụ hybrid thế hệ cũ (như Cordova), Capacitor cho phép lập trình viên kiểm soát trực tiếp project Android gốc (`android/`), tùy biến file `AndroidManifest.xml`, `build.gradle` và tích hợp các plugin phần cứng chính hãng:
- `@capacitor/camera`: Truy cập trực tiếp Camera phần cứng của thiết bị di động.
- `@capacitor/network`: Bắt sự kiện mạng hệ thống (`Network.addListener('networkStatusChange')`) chính xác hơn các sự kiện mạng mặc định của WebView.

### 4.2. Cấu hình [capacitor.config.ts](file:///c:/Users/hunga/Documents/Materials/Cross_platform_dev/vku-field-survey/capacitor.config.ts)
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.edu.vku.fieldsurvey',
  appName: 'VKU Field Survey',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      // Quyền truy cập camera được định cấu hình cho Android
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
```

### 4.3. Các bước đóng gói ứng dụng (Packaging Steps)

1. **Biên dịch mã nguồn Web:**
   ```bash
   npm run build
   ```
   Tạo ra các tệp tĩnh tối ưu hóa trong thư mục `dist/`.

2. **Cài đặt thư viện Android Native & Sinh cấu trúc:**
   ```bash
   npm install @capacitor/android
   npx cap add android
   ```
   Lệnh này tự động khởi tạo thư mục `android/` chứa toàn bộ mã nguồn Java/Kotlin và Gradle của ứng dụng Android.

3. **Đồng bộ mã nguồn và plugin vào Android:**
   ```bash
   npx cap sync android
   ```
   Tự động sao chép các tệp tĩnh từ `dist/` vào `android/app/src/main/assets/public` và cấu hình các plugin Camera, Network.

4. **Biên dịch file APK qua Gradle:**
   ```powershell
   cd android
   .\gradlew.bat assembleDebug
   ```
   File cài đặt Android hoàn tất được xuất ra tại:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 5. KỊCH BẢN KIỂM THỬ THỰC TẾ & KẾT QUẢ

### Kịch bản 1: Kiểm thử Cài đặt PWA Standalone (Desktop & Mobile)
* **Thao tác:** Truy cập ứng dụng qua trình duyệt Chrome/Edge ➔ Bấm vào biểu tượng Cài đặt trên thanh địa chỉ (Install VKU Field Survey).
* **Kết quả:** Ứng dụng xuất hiện trên màn hình chính (Home Screen) như một app độc lập, mở trong cửa sổ không có thanh URL của trình duyệt, logo biểu tượng và theme header màu xanh dương đặc trưng của VKU (`#0284c7`).

### Kịch bản 2: Kiểm thử Cơ chế Lưu nháp (Draft Recovery)
* **Thao tác:** 
  1. Đang nhập phiếu khảo sát tại Khu V - Tầng 3 - Phòng V.301.
  2. Chọn thiết bị Điều hòa, gắn tag "Chảy nước", nhập nội dung ghi chú dở dang.
  3. Đột ngột tắt trình duyệt hoặc nhấn phím `F5` tải lại trang.
* **Kết quả:** Ứng dụng tự động đọc bản ghi từ store `draft` của IndexedDB và điền đầy đủ toàn bộ thông tin đã nhập vào form, không bị mất bất kỳ dữ liệu nào.

### Kịch bản 3: Kiểm thử Chụp ảnh & Nén ảnh Hiện trường
* **Thao tác:** Bấm nút "Chụp ảnh hiện trạng" ➔ Tải lên ảnh chụp thực tế dung lượng 5.2MB.
* **Kết quả:** Canvas API xử lý nén trong 80ms, dung lượng ảnh giảm xuống còn **214KB**, ảnh xem trước (Preview) hiển thị sắc nét, nút xóa/chụp lại hoạt động chính xác.

### Kịch bản 4: Kiểm thử Hoạt động Ngoại tuyến (Full Offline Mode)
* **Thao tác:**
  1. Ngắt hoàn toàn kết nối Wi-Fi và mạng di động (Bật Airplane Mode hoặc chọn chế độ *Offline* trong DevTools).
  2. Ứng dụng lập tức chuyển trạng thái trên Header: Hiển thị thanh cảnh báo màu cam `"Ngoại tuyến - Dữ liệu sẽ lưu cục bộ"`.
  3. Nhấn nút "Lưu & Gửi Báo Cáo".
* **Kết quả:** 
  - Phiếu khảo sát được ghi nhận thành công vào IndexedDB với mã UUID duy nhất.
  - Form được reset sẵn sàng cho lượt khảo sát tiếp theo.
  - Trong tab "Lịch sử khảo sát", bản ghi hiển thị huy hiệu màu cam: `Chờ đồng bộ (Pending Sync)`.
  - Dashboard KPI cập nhật tức thời: Thẻ "Chờ đồng bộ" tăng lên 1.

### Kịch bản 5: Kiểm thử Tự động Đồng bộ (Auto-Sync on Reconnect)
* **Thao tác:** Bật lại kết nối Internet.
* **Kết quả:**
  - Header tự động chuyển về trạng thái màu xanh `"Đang kết nối"`.
  - Sync Engine tự động kích hoạt: Duyệt qua danh sách các bản ghi `PENDING_SYNC` và gửi tuần tự lên endpoint `/api/submissions`.
  - Thông báo Toast hiển thị: `"Đã đồng bộ thành công X phiếu khảo sát"`.
  - Toàn bộ huy hiệu trong danh sách lịch sử chuyển thành màu xanh lá: `Đã đồng bộ (Synced)`.

### Kịch bản 6: Kiểm thử Xuất Báo cáo CSV/Excel
* **Thao tác:** Tại màn hình Lịch sử, bấm nút "Xuất file CSV".
* **Kết quả:** Trình duyệt tự động tải về tệp `vku_field_survey_reports.csv` mã hóa UTF-8 with BOM, hiển thị đầy đủ tiếng Việt có dấu, chứa đầy đủ các cột: Mã phiếu, Tòa nhà, Phòng, Thiết bị, Lỗi chi tiết, Đánh giá sao, Tọa độ GPS, Thời gian khảo sát và Trạng thái đồng bộ.

---

## 6. HƯỚNG DẪN CÀI ĐẶT & VẬN HÀNH

### 6.1. Yêu cầu Hệ thống
* **Node.js:** Phiên bản 20.x trở lên.
* **Trình quản lý gói:** npm 9.x hoặc 10.x.
* **Môi trường Android:** Android Studio, Android SDK (API 34/35/36), JDK 17 hoặc 21.

### 6.2. Cài đặt và Chạy thử nghiệm trên Web Local
```bash
# 1. Di chuyển vào thư mục dự án
cd vku-field-survey

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Sao chép file cấu hình môi trường mẫu
copy .env.example .env

# 4. Khởi chạy máy chủ phát triển
npm run dev
```
Truy cập địa chỉ: **`http://localhost:5173`**

### 6.3. Triển khai Live Demo lên Cloudflare
* **Đường dẫn Live Demo hoạt động chính thức:** [https://vku-field-survey.hungabc2206.workers.dev/](https://vku-field-survey.hungabc2206.workers.dev/)
* **Kho lưu trữ GitHub:** [https://github.com/hungbbdzz/vku-field-survey](https://github.com/hungbbdzz/vku-field-survey)
* Khi cần đẩy bản cập nhật mới từ máy tính:
  ```bash
  npm run build
  npx wrangler deploy
  ```

### 6.4. Build file Android APK
```powershell
# Bước 1: Build Web và đồng bộ Capacitor
npm run cap:sync

# Bước 2: Build file APK cài đặt
cd android
.\gradlew.bat assembleDebug
```
File APK thu được tại: `android/app/build/outputs/apk/debug/app-debug.apk`. 
Có thể cài đặt trực tiếp lên thiết bị Android bằng lệnh:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. KẾT LUẬN & HƯỚNG PHÁT TRIỂN

### 7.1. Đánh giá Kết quả đạt được
1. **Hoàn thiện 100% mục tiêu đề ra:** Xây dựng thành công ứng dụng PWA Offline-First tiêu chuẩn, giải quyết trọn vẹn bài toán rớt mạng khi khảo sát cơ sở vật chất tại VKU.
2. **Hiệu năng xuất sắc:** Tốc độ phản hồi tức thì nhờ mô hình lưu trữ cục bộ IndexedDB, thuật toán nén ảnh Canvas giúp tiết kiệm đến 95% dung lượng truyền tải mạng.
3. **Tính linh hoạt cao:** Vừa có thể truy cập qua trình duyệt web trên bất kỳ hệ điều hành nào (PWA), vừa có thể đóng gói thành file Native APK cài đặt trực tiếp trên Android qua Capacitor mà không cần viết lại mã nguồn.

### 7.2. Hướng phát triển tiếp theo
* **Tích hợp Capgo Live Updates:** Tích hợp plugin `@capgo/capacitor-updater` để hỗ trợ đẩy các bản vá lỗi giao diện và cập nhật tính năng trực tiếp qua OTA (Over-The-Air) mà người dùng không cần cài lại file APK.
* **Bản đồ số khuôn viên VKU (Campus GIS Map):** Tích hợp bản đồ trực quan (Leaflet/Mapbox) với sơ đồ các tòa nhà V, K, A, B, C giúp cán bộ kỹ thuật quan sát trực quan vị trí các thiết bị đang báo lỗi khẩn cấp.
* **Phân quyền người dùng (Role-Based Access Control):** Mở rộng hệ thống tài khoản phân biệt giữa Sinh viên/Cán bộ phản ánh và Đội ngũ Kỹ thuật viên bảo trì tiếp nhận sửa chữa.

