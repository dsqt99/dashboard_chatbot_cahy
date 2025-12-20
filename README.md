# CAHY Chatbot Dashboard

Dashboard giám sát hệ thống chatbot CAHY (Công An Hưng Yên). Frontend chạy Vite + React, lấy dữ liệu qua các webhook n8n (Portal Messages, Chat History, RAG Documents).

## Tính năng chính

- **Tổng Quan Hệ Thống**: biểu đồ request, monitor Portal Messages, thống kê tài liệu và phiên chat
- **Lịch sử trò chuyện**: xem các session và nội dung theo `session_id`
- **Tài liệu PDF**: tải lên/xoá/xử lý tài liệu qua webhook n8n

## Yêu cầu

- Node.js 18+ (khuyến nghị 20)
- npm

## Chạy local (development)

```bash
npm install
npm run dev
```

## Build (production)

```bash
npm run build
```

## Cấu hình môi trường (`.env`)

Tạo file `.env` ở thư mục gốc dự án và cấu hình các biến cần thiết. Không commit secrets.

```env
# n8n public API (nếu dùng các màn quản trị workflow; có thể để trống API key)
VITE_N8N_API_URL=https://n8n-hungyen.cahy.io.vn/
VITE_N8N_API_KEY=

# Webhook: Portal Messages (POST)
VITE_PORTAL_MESSAGES_URL=https://n8n-hungyen.cahy.io.vn/webhook/get_all_messages

# Webhook: Chat History (POST)
VITE_CHAT_HISTORY_ALL_URL=https://n8n-hungyen.cahy.io.vn/webhook/get_history_session
VITE_CHAT_HISTORY_BY_SESSION_URL=https://n8n-hungyen.cahy.io.vn/webhook/get_history_from_sessionId

# Webhook: RAG Documents
VITE_RAG_GET_DOCUMENTS_URL=https://n8n-hungyen.cahy.io.vn/webhook/get-documents
VITE_RAG_REMOVE_DOCUMENT_URL=https://n8n-hungyen.cahy.io.vn/webhook/remove-document
VITE_RAG_UPLOAD_DOCUMENT_URL=https://n8n-hungyen.cahy.io.vn/webhook/upload-document
VITE_RAG_DOCUMENT_PROCESSING_URL=https://n8n-hungyen.cahy.io.vn/webhook/document-processing
```

Ghi chú:
- `get_history_session` không nhận `GET`, cần gọi `POST`.
- Frontend không nên chứa thông tin đăng nhập DB. Nếu cần truy cập DB nội bộ, hãy đi qua n8n/webhook hoặc một backend trung gian.

## Deploy Docker (Nginx) + Traefik

Repo đã có sẵn:
- `Dockerfile`: build Vite và serve bằng `nginx`
- `nginx/default.conf`: cấu hình SPA route fallback
- `docker-compose.dashboard.yml`: labels Traefik cho domain `dashboard.chatbot.cahy.io.vn`

Yêu cầu:
- Traefik chạy riêng ở stack khác và đang theo dõi Docker provider
- Có external network `processing-report-dashboard_proxy-net`
- Traefik có certresolver tên `myresolver`

Chạy:

```bash
docker compose -f docker-compose.dashboard.yml up -d --build
```

## Cấu trúc dự án

```
dashboard/
├── src/
├── public/
├── nginx/
│   └── default.conf
├── Dockerfile
├── docker-compose.dashboard.yml
├── package.json
└── vite.config.ts
```