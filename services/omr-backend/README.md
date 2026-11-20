---
title: Piano Waterfall OMR
emoji: 🎹
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Piano Waterfall — PDF OMR Backend

Dịch vụ FastAPI chuyển đổi bản nhạc **PDF nhiều trang → MusicXML** theo cơ chế bất đồng bộ (không bị timeout trên cloud miễn phí).

## Deploy miễn phí lên Hugging Face Spaces (HTTPS cho cả Android & iOS)
1. Tạo một Space mới trên [Hugging Face Spaces](https://huggingface.co/spaces) chọn SDK **Docker (Blank)**.
2. Tải toàn bộ file trong thư mục `services/omr-backend/` lên Space đó.
3. Đợi Space build xong, sao chép URL dạng `https://<user>-<space>.hf.space` rồi dán vào mục **Cài đặt → Địa chỉ máy chủ OMR** trong app Piano Waterfall.

## Chạy cục bộ trên máy tính
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 7860
```
