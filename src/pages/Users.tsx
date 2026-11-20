import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import Modal from '../components/Modal'
import { DeptError, DeptOptions, Empty, ErrorBox, OrphanDept, PageHeader, Segmented, fmtAgo } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { api, type Role, type User, type UserStatus } from '../lib/api'

const STATUS_BADGE: Record<UserStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ duyệt', cls: 'bg-warn/10 text-warn' },
  active: { label: 'Hoạt động', cls: 'bg-ok/10 text-ok' },
  rejected: { label: 'Từ chối', cls: 'bg-danger/10 text-danger' },
  suspended: { label: 'Tạm khóa', cls: 'bg-sunken text-muted' },
}

export default function Users() {
  const [filter, setFilter] = useState<string>('')
  const usersRes = useAsync(() => api.listUsers(filter), [filter])
  const depts = useAsync(() => api.departments(), [])

  const [err, setErr] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [status, setStatus] = useState<UserStatus>('active')
  const [deptId, setDeptId] = useState('')

  const openCreate = () => {
    setEditing(null)
    setUsername('')
    setPassword('')
    setFullName('')
    setRole('staff')
    setStatus('active')
    setDeptId('')
    setErr('')
    setFormOpen(true)
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setUsername(u.username)
    setPassword('')
    setFullName(u.full_name || '')
    setRole(u.role)
    setStatus(u.status || 'active')
    setDeptId(u.department_id || '')
    setErr('')
    setFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr('')
    const dept = depts.data?.find((d) => d.id === deptId)
    try {
      if (editing) {
        await api.updateUser(editing.id, {
          full_name: fullName.trim(),
          role,
          status,
          department_id: deptId,
          department_name: dept?.name || '',
          ...(password.trim() ? { password: password.trim() } : {}),
        })
      } else {
        await api.createUser({
          username: username.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          role,
          department_id: deptId,
          department_name: dept?.name || '',
        })
      }
      setFormOpen(false)
      usersRes.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Lưu tài khoản thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (u: User) => {
    setErr('')
    try {
      await api.approveUser(u.id)
      usersRes.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Duyệt tài khoản thất bại')
    }
  }

  const handleReject = async (u: User) => {
    setErr('')
    try {
      await api.rejectUser(u.id)
      usersRes.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Từ chối tài khoản thất bại')
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`Xoá tài khoản "${u.username}"?`)) return
    setErr('')
    try {
      await api.deleteUser(u.id)
      usersRes.reload()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Xoá tài khoản thất bại')
    }
  }

  return (
    <>
      <PageHeader
        title="Quản lý tài khoản"
        desc="Tạo, phân quyền phòng ban và phê duyệt tài khoản cán bộ đăng nhập hệ thống."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Thêm tài khoản
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Lọc trạng thái tài khoản"
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'pending', label: `Chờ duyệt${usersRes.data?.pending_count ? ` (${usersRes.data.pending_count})` : ''}` },
            { value: 'active', label: 'Hoạt động' },
            { value: 'suspended', label: 'Tạm khóa' },
            { value: 'rejected', label: 'Từ chối' },
          ]}
        />
      </div>

      {err && !formOpen && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err}
        </div>
      )}

      <section className="card" aria-label="Danh sách tài khoản">
        {usersRes.error ? (
          <ErrorBox message={usersRes.error} onRetry={usersRes.reload} />
        ) : !usersRes.data ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12" />)}</div>
        ) : !usersRes.data.users.length ? (
          <Empty title="Không có tài khoản nào" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sunken/50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tài khoản</th>
                  <th className="px-4 py-3 font-medium">Vai trò</th>
                  <th className="px-4 py-3 font-medium">Phòng ban</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Đăng nhập gần nhất</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usersRes.data.users.map((u) => {
                  const st = STATUS_BADGE[u.status || 'active']
                  return (
                    <tr key={u.id} className="hover:bg-sunken/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.full_name || u.username}</p>
                        <p className="font-mono text-xs text-muted">@{u.username}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{u.role === 'admin' ? 'Quản trị viên' : 'Cán bộ'}</td>
                      <td className="px-4 py-3 text-xs text-muted">{u.department_name || '—'}<OrphanDept id={u.department_id} depts={depts.data} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{u.last_login_at ? fmtAgo(u.last_login_at) : 'Chưa đăng nhập'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          {u.status === 'pending' && (
                            <>
                              <button type="button" onClick={() => handleApprove(u)} className="btn-ghost h-8 px-2.5 text-xs text-ok" title="Duyệt">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleReject(u)} className="btn-ghost h-8 px-2.5 text-xs text-danger" title="Từ chối">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button type="button" onClick={() => openEdit(u)} className="btn-ghost h-8 px-2.5 text-xs" title="Sửa">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(u)} className="btn-ghost h-8 px-2.5 text-xs text-danger hover:bg-danger/10" title="Xoá">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Cập nhật tài khoản: @${editing.username}` : 'Thêm tài khoản mới'}>
        <form onSubmit={handleSave} className="space-y-4">
          {err && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{err}</p>}
          {!editing && (
            <div>
              <label htmlFor="u-name" className="label">Tên đăng nhập</label>
              <input id="u-name" className="field font-mono" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="vd: canbo.pa08" />
            </div>
          )}
          <div>
            <label htmlFor="u-full" className="label">Họ và tên</label>
            <input id="u-full" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label htmlFor="u-pass" className="label">
              {editing ? 'Mật khẩu mới (để trống nếu giữ nguyên)' : 'Mật khẩu (tối thiểu 8 ký tự)'}
            </label>
            <input id="u-pass" type="password" className="field" required={!editing} minLength={editing ? undefined : 8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="u-role" className="label">Vai trò</label>
              <select id="u-role" className="field" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="staff">Cán bộ (theo phòng ban)</option>
                <option value="admin">Quản trị viên (toàn quyền)</option>
              </select>
            </div>
            {editing && (
              <div>
                <label htmlFor="u-status" className="label">Trạng thái</label>
                <select id="u-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                  <option value="active">Hoạt động</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="suspended">Tạm khóa</option>
                  <option value="rejected">Từ chối</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="u-dept" className="label">Phòng ban</label>
            <select id="u-dept" className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              <DeptOptions value={deptId} depts={depts.data} />
            </select>
            {depts.error && <DeptError message={depts.error} onRetry={depts.reload} />}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </form>
      </Modal>
    </>
  )
}

