# Dashboard Quản lý Chatbot CAHY

Dashboard quản lý hệ thống chatbot Công an tỉnh Hưng Yên, tích hợp với Supabase và n8n.

## Tính năng

- 📊 **Dashboard thống kê**: Thống kê vector stores, workflow executions
- 💬 **Quản lý Q&A**: CRUD Q&A, import/export Excel, re-index vector store
- 🗄️ **Quản lý Vector Stores**: Xem thống kê và quản lý vector stores
- 📄 **Quản lý Tài liệu PDF**: Upload và quản lý tài liệu PDF
- ⚙️ **Quản lý Workflows n8n**: Quản lý và trigger workflows
- 🔧 **Cấu hình Chatbot**: Chỉnh sửa system prompt và parameters

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

3. Cấu hình các biến môi trường trong file `.env`:
```env
# Supabase Configuration (kết nối đến PostgreSQL)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# n8n Configuration
VITE_N8N_API_URL=http://localhost:5678
VITE_N8N_API_KEY=your_n8n_api_key
```

### Cấu hình PostgreSQL

Dashboard cần kết nối đến PostgreSQL để quản lý documents từ `document_store` workflow.

**Thông tin PostgreSQL:**
- Host: 100.94.101.101
- Database: chatbot
- User: admin
- Password: abcd@1234
- Table: `chatbot_documents_vectorstore`

Xem hướng dẫn chi tiết trong file [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) để cấu hình kết nối PostgreSQL.

## Chạy ứng dụng

Development:
```bash
npm run dev
```

Build production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Cấu trúc dự án

```
dashboard/
├── src/
│   ├── components/      # React components
│   ├── pages/           # Page components
│   ├── services/        # API services (Supabase, n8n)
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static files
├── package.json
└── vite.config.ts
```

## API Integration

### Supabase
- Q&A management: `qnaService`
- Query types: `queryTypeService`
- Vector store stats: `vectorStoreService`

### n8n
- Workflow management: `n8nService`
- Execution tracking
- Manual workflow triggers

## Lưu ý

- Cần cấu hình CORS cho n8n API nếu chạy trên domain khác
- Supabase RLS policies cần được cấu hình đúng (xem POSTGRES_SETUP.md)
- n8n API key cần có quyền đọc và thực thi workflows
- PostgreSQL credentials không được expose trong frontend code
- Nếu không dùng Supabase, cần tạo backend API proxy để kết nối PostgreSQL

## Cấu hình PostgreSQL

Xem file [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) để biết cách cấu hình kết nối đến PostgreSQL server.

