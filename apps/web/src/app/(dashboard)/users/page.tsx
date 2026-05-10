'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Settings2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Dialog States
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  // Forms
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'USER', telegramId: '' })
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', telegramId: '' })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const response = await api.get('/user')
    if (response.success) {
      setUsers(response.data)
    } else {
      const debug = response.debug_info ? ` (Role Anda: ${response.debug_info.your_role})` : ''
      toast.error((response.message || 'Gagal mengambil data user.') + debug)
    }
    setLoading(false)
  }

  // CREATE USER
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const res = await api.post('/auth/register', addForm)
    if (res.success) {
      toast.success('Pengguna berhasil ditambahkan')
      setAddOpen(false)
      setAddForm({ name: '', email: '', password: '', role: 'USER', telegramId: '' })
      fetchUsers()
    } else {
      toast.error(res.message || 'Gagal menambahkan pengguna')
    }
  }

  // UPDATE USER
  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await api.patch(`/user/${selectedUser.id}`, editForm)
    if (res.success) {
      toast.success('Data pengguna berhasil diperbarui')
      setEditOpen(false)
      fetchUsers()
    } else {
      toast.error('Gagal memperbarui pengguna')
    }
  }

  // DELETE USER
  async function handleDelete(id: string) {
    if (confirm('Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak bisa dibatalkan.')) {
      const res = await api.delete(`/user/${id}`)
      if (res.success) {
        toast.success('Pengguna dihapus')
        fetchUsers()
      } else {
        toast.error(res.message || 'Gagal menghapus pengguna')
      }
    }
  }

  const openEditModal = (user: any) => {
    setSelectedUser(user)
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      telegramId: user.telegramId || ''
    })
    setEditOpen(true)
  }

  const [pageSize, setPageSize] = useState<number | 'All'>(30)
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(users.length / pageSize)
  const paginatedUsers = pageSize === 'All' 
    ? users 
    : users.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-slate-500">Kelola pengguna dan hak akses aplikasi.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 hover:bg-slate-800 transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Tambah User
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200/50">
        <CardContent className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm text-slate-500">Tampilkan:</Label>
              <Select 
                value={String(pageSize)} 
                onValueChange={(val) => {
                  if (!val) return
                  setPageSize(val === 'All' ? 'All' : Number(val))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="All">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-slate-500">
              Total: {users.length} data
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[25%] font-semibold text-slate-700 text-center">Nama</TableHead>
                  <TableHead className="w-[30%] font-semibold text-slate-700 text-center">Email</TableHead>
                  <TableHead className="w-[15%] font-semibold text-slate-700 text-center">Role</TableHead>
                  <TableHead className="w-[20%] font-semibold text-slate-700 text-center">Telegram Username</TableHead>
                  <TableHead className="text-center w-[10%] font-semibold text-slate-700">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Memuat data...</TableCell>
                  </TableRow>
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Tidak ada data user.</TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-center">{u.name}</TableCell>
                      <TableCell className="text-center">{u.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                          {u.telegramId ? `@${u.telegramId}` : 'Belum Terhubung'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => openEditModal(u)}>
                            <Settings2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDelete(u.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {pageSize !== 'All' && totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-slate-50/50">
              <p className="text-sm text-slate-500">
                Halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL TAMBAH USER */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Tambah Pengguna Baru</DialogTitle>
              <DialogDescription>Daftarkan akun karyawan baru ke dalam sistem.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role (Akses)</Label>
                <Select value={addForm.role} onValueChange={(val) => setAddForm({...addForm, role: val})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Pilih Akses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER (Karyawan Biasa)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Manajer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="password">Password Sementara</Label>
                  <Input id="password" type="password" required value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telegram">Telegram Username</Label>
                  <Input id="telegram" placeholder="Tanpa @" value={addForm.telegramId} onChange={e => setAddForm({...addForm, telegramId: e.target.value})} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Batal</Button>
              <Button type="submit">Buat Akun</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIT USER */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <form onSubmit={(e) => {
            if (editForm.telegramId) {
              editForm.telegramId = editForm.telegramId.replace('@', '').trim();
            }
            handleEdit(e);
          }}>
            <DialogHeader>
              <DialogTitle>Edit Pengguna</DialogTitle>
              <DialogDescription>Ubah detail dan hak akses untuk {selectedUser?.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Nama</Label>
                  <Input id="edit-name" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" type="email" required value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role (Akses)</Label>
                <Select value={editForm.role} onValueChange={(val) => setEditForm({...editForm, role: val})}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Pilih Akses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER (Karyawan Biasa)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Manajer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-telegram">Telegram Username</Label>
                <Input id="edit-telegram" placeholder="Kosongkan jika belum ada..." value={editForm.telegramId} onChange={e => setEditForm({...editForm, telegramId: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Batal</Button>
              <Button type="submit">Simpan Perubahan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
