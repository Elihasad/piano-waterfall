# Piano Waterfall — Ứng dụng tập Piano nốt rơi (Android APK & iOS PWA)

Ứng dụng tập đàn piano kiểu thác nước nốt rơi (lấy cảm hứng từ MuseScore & Synthesia), thiết kế tối ưu cho **điện thoại xoay ngang đặt trên giá đàn**:

- **Hỗ trợ file nhạc:** Đọc trực tiếp **MusicXML** (`.musicxml`, `.xml`, `.mxl`) & **MIDI** (`.mid`) 100% offline trên điện thoại; hỗ trợ chuyển đổi **PDF nhiều trang** qua máy chủ Python OMR rồi lưu offline vĩnh viễn vào máy.
- **Hiện tên nốt rõ ràng:** Hiện tên nốt (`C, D, E, F#...` hoặc `Đô, Rê, Mi...`) ngay trên từng thanh nốt rơi và trên phím đàn.
- **Tối ưu cho cách tập từng đoạn:**
  - Tự động phóng to vùng phím đàn theo khoảng nốt của bài (`Auto` / `88 phím`).
  - Vuốt trực tiếp lên thác nước để tua từng nhịp, nút tiến/lùi từng ô nhịp, lặp đoạn **A–B**, chỉnh **BPM**, đổi **Tone**.
  - Tách riêng **Âm thanh** và **Hiển thị** cho từng tay (ví dụ: tắt tiếng tay phải nhưng vẫn để nốt rơi để tự đánh theo phần đệm tay trái).

---

## 1. Chạy thử ngay trên máy tính
```powershell
cd apps/web
npm install
npm run dev
```
Mở trình duyệt tại địa chỉ hiển thị (thường là `http://localhost:5173`).

## 2. Lấy file `.apk` cài trên điện thoại Android (Tự động miễn phí qua GitHub Actions)
1. Đẩy mã nguồn này lên một repository GitHub của anh (nhánh `main`).
2. Vào tab **Actions** trên GitHub → chọn workflow **Build Android APK**.
3. Sau vài phút build xong, tải mục **Artifacts → `piano-waterfall-debug-apk`** về, giải nén lấy file `app-debug.apk` và cài trực tiếp lên điện thoại Android.

## 3. Cài như app thật trên iPhone / iPad (iOS PWA Offline)
1. Trong repository GitHub, vào **Settings → Pages → Source**, chọn **GitHub Actions**.
2. Workflow **Deploy iOS & Web PWA to GitHub Pages** sẽ tự động xuất bản trang HTTPS miễn phí.
3. Mở đường dẫn đó bằng **Safari** trên iPhone/iPad → bấm nút **Chia sẻ (Share)** → **Thêm vào Màn hình chính (Add to Home Screen)**. Sau lần mở đầu tiên, app chạy full màn hình xoay ngang và tập **offline hoàn toàn**.

## 4. Bật tính năng tải lên file PDF nhiều trang (OMR Backend)
1. Tạo 1 Space miễn phí trên [Hugging Face Spaces](https://huggingface.co/spaces) với SDK **Docker (Blank)**.
2. Tải toàn bộ file trong thư mục `services/omr-backend/` lên Space.
3. Sau khi Space chạy xong, sao chép URL HTTPS (ví dụ `https://ten-cua-anh-omr.hf.space`) → mở app Piano Waterfall → bấm biểu tượng **Cài đặt (⚙️)** → dán URL → **Kiểm tra kết nối** → **Lưu**.
4. Từ lúc này anh có thể chọn file `.pdf` ngay trong mục **Thư viện** của app; app sẽ báo tiến độ từng trang và lưu bài vào điện thoại để tập offline mãi mãi.
