# Hướng dẫn cấu hình PostgreSQL cho Dashboard

## Thông tin PostgreSQL

- **Host**: 100.94.101.101
- **Database**: chatbot
- **User**: admin
- **Password**: abcd@1234
- **Table**: `chatbot_documents_vectorstore` (lưu chunks từ document_store workflow)

## Cách 1: Sử dụng Supabase (Khuyến nghị)

Supabase có thể kết nối đến PostgreSQL server của bạn. Cấu hình như sau:

### Bước 1: Tạo Supabase Project
1. Đăng ký tại [supabase.com](https://supabase.com)
2. Tạo project mới

### Bước 2: Kết nối Supabase đến PostgreSQL của bạn
1. Vào Settings > Database
2. Cấu hình connection pool hoặc direct connection đến PostgreSQL server:
   - Host: `100.94.101.101`
   - Database: `chatbot`
   - User: `admin`
   - Password: `abcd@1234`

### Bước 3: Cấu hình trong Dashboard
Tạo file `.env` trong thư mục `dashboard/`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_N8N_API_URL=http://localhost:5678
VITE_N8N_API_KEY=your_n8n_api_key
```

### Bước 4: Cấu hình RLS Policies trong Supabase
Đảm bảo các bảng có RLS policies phù hợp:

```sql
-- Cho phép đọc chatbot_documents_vectorstore
CREATE POLICY "Allow read chatbot_documents_vectorstore"
ON chatbot_documents_vectorstore
FOR SELECT
USING (true);

-- Cho phép xóa (nếu cần)
CREATE POLICY "Allow delete chatbot_documents_vectorstore"
ON chatbot_documents_vectorstore
FOR DELETE
USING (true);
```

## Cách 2: Tạo Backend API Proxy

Nếu không muốn dùng Supabase, bạn cần tạo một backend API để kết nối đến PostgreSQL.

### Tạo Backend API (Node.js/Express)

1. Tạo file `backend/server.js`:

```javascript
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  host: '100.94.101.101',
  database: 'chatbot',
  user: 'admin',
  password: 'abcd@1234',
  port: 5432,
});

// Get documents
app.get('/api/documents', async (req, res) => {
  try {
    const { type, limit = 100 } = req.query;
    let query = 'SELECT id, content, metadata FROM chatbot_documents_vectorstore';
    const params = [];
    
    if (type) {
      query += ' WHERE metadata->>\'type\' = $1';
      params.push(type);
    }
    query += ' ORDER BY id DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get document stats
app.get('/api/documents/stats', async (req, res) => {
  try {
    const [total, summary, chunk] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM chatbot_documents_vectorstore'),
      pool.query('SELECT COUNT(*) FROM chatbot_documents_vectorstore WHERE metadata->>\'type\' = $1', ['summary']),
      pool.query('SELECT COUNT(*) FROM chatbot_documents_vectorstore WHERE metadata->>\'type\' = $1', ['chunk']),
    ]);
    
    res.json({
      total: parseInt(total.rows[0].count),
      summaries: parseInt(summary.rows[0].count),
      chunks: parseInt(chunk.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM chatbot_documents_vectorstore WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
```

2. Cài đặt dependencies:
```bash
npm install express pg cors
```

3. Chạy backend:
```bash
node backend/server.js
```

4. Cập nhật `dashboard/src/services/postgres.ts` để sử dụng backend API thay vì Supabase.

## Kiểm tra kết nối

Sau khi cấu hình, kiểm tra kết nối bằng cách:

1. Mở Dashboard
2. Vào trang "Quản lý Tài liệu PDF"
3. Xem có hiển thị documents không

## Lưu ý bảo mật

⚠️ **Quan trọng**: Không bao giờ expose PostgreSQL credentials trong frontend code!

- Nếu dùng Supabase: Credentials được quản lý bởi Supabase
- Nếu dùng Backend API: Credentials chỉ có trong backend, frontend gọi API

## Troubleshooting

### Lỗi kết nối
- Kiểm tra PostgreSQL server có đang chạy không
- Kiểm tra firewall có chặn port 5432 không
- Kiểm tra credentials có đúng không

### Lỗi RLS policies (nếu dùng Supabase)
- Đảm bảo đã tạo policies cho các bảng
- Kiểm tra service role key nếu cần

### Lỗi CORS
- Cấu hình CORS trong backend API
- Hoặc dùng Supabase (đã có CORS sẵn)

