# Warhammer 40K Sealed List Reveal

Công cụ bảo mật danh sách quân đội Warhammer 40K, ngăn chặn tình trạng "counter-listing" bằng cách chỉ công bố danh sách khi cả hai người chơi đã nộp bài.

## 🚀 Công nghệ sử dụng
- **Frontend**: React 19, Tailwind CSS 4, Lucide React, Motion.
- **Backend**: Express.js (chạy song song với Vite/Vercel).
- **Database**: Firebase Firestore.
- **Realtime**: Firebase SDK (onSnapshot).
- **Cleanup**: Firebase Admin SDK (xóa dữ liệu tự động).

## 🛠 Hướng dẫn cài đặt cho Đội Kỹ thuật

### 1. Chuẩn bị
- Node.js 18+
- Một Project Firebase đã được tạo trên [Firebase Console](https://console.firebase.google.com/).
- Bật dịch vụ **Firestore Database** và **Firebase Authentication** (chỉ cần bật, ứng dụng dùng cơ chế nộp list không cần login bắt buộc nhưng có hỗ trợ mở rộng).

### 2. Cấu hình Firebase
Tạo file `firebase-applet-config.json` ở thư mục gốc với nội dung lấy từ cài đặt Project Firebase của bạn:
```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "projectId": "YOUR_PROJECT_ID",
  "appId": "YOUR_APP_ID",
  "firestoreDatabaseId": "(default)"
}
```

### 3. Cấu hình Security Rules
Copy nội dung từ file `firestore.rules` và dán vào phần **Rules** của Firestore trong Firebase Console. Đây là bước **quan trọng nhất** để đảm bảo list không bị xem trộm trước khi reveal.

### 4. Cài đặt và Chạy local
```bash
# Cài đặt dependencies
npm install

# Chạy môi trường phát triển
npm run dev
```

### 5. Triển khai lên Vercel
Dự án này được thiết kế để chạy Full-stack trên Vercel:
- Kết nối GitHub repo với Vercel.
- Vercel sẽ tự động nhận diện `server.ts` thông qua cấu hình trong `package.json`.
- Đảm bảo các file `dist` được tạo sau khi build để Express phục vụ file tĩnh.

## 🧹 Cơ chế dọn dẹp dữ liệu (Cleanup)
Hệ thống có một tác vụ chạy ngầm trong `server.ts`:
- **Trận đấu mới**: Hết hạn sau 48 giờ nếu không có ai nộp hoặc chỉ 1 người nộp.
- **Trận đấu đã Reveal**: Hết hạn sau **24 giờ** kể từ thời điểm công bố.
- Server sẽ quét mỗi giờ một lần để xóa các bản ghi đã quá hạn nhằm tiết kiệm dung lượng.

## 📁 Cấu trúc thư mục chính
- `/src/App.tsx`: Chứa toàn bộ logic giao diện và xử lý phase của trận đấu.
- `/server.ts`: Server Express xử lý Cleanup task và phục vụ ứng dụng.
- `/firestore.rules`: Quy tắc bảo mật cho cơ sở dữ liệu.
- `/src/firebase.ts`: Khởi tạo kết nối với Firebase.

## 📝 Lưu ý quan trọng
- **Mã hóa**: List được lưu trong subcollection `/matches/{id}/lists/{p1|p2}`. Quy tắc bảo mật chỉ cho phép đọc subcollection này khi field `revealed` ở document cha là `true`.
- **Tải xuống**: Tính năng xuất file `.txt` được xử lý hoàn toàn ở client-side, không tốn tài nguyên server.
