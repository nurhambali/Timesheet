'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function TimesheetPage() {
  const [entries, setEntries] = useState([])
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    project: '',
    activity: '',
    duration: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  })

  const fetchEntries = async () => {
    const response = await api.get('/timesheet')
    if (response.success) setEntries(response.data)
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await api.post('/timesheet', {
      ...formData,
      duration: parseFloat(formData.duration),
    })

    if (response.success) {
      toast.success('Berhasil menyimpan catatan waktu')
      setOpen(false)
      fetchEntries()
      setFormData({
        project: '',
        activity: '',
        duration: '',
        date: new Date().toISOString().split('T')[0],
        note: '',
      })
    } else {
      toast.error('Gagal menyimpan data')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      const response = await api.delete(`/timesheet/${id}`)
      if (response.success) {
        toast.success('Data dihapus')
        fetchEntries()
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet</h2>
          <p className="text-slate-500">Kelola catatan jam kerja Anda di sini.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Tambah Entry
              </Button>
            }
          />
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Tambah Catatan Waktu</DialogTitle>
                <DialogDescription>
                  Masukkan detail aktivitas kerja Anda hari ini.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="project">Proyek</Label>
                  <Input 
                    id="project" 
                    placeholder="Contoh: Website Redesign" 
                    value={formData.project}
                    onChange={e => setFormData({...formData, project: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="activity">Aktivitas</Label>
                  <Input 
                    id="activity" 
                    placeholder="Contoh: Coding Frontend" 
                    value={formData.activity}
                    onChange={e => setFormData({...formData, activity: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Durasi (Jam)</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      step="0.5" 
                      placeholder="1.5" 
                      value={formData.duration}
                      onChange={e => setFormData({...formData, duration: e.target.value})}
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Tanggal</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">Catatan (Opsional)</Label>
                  <Input 
                    id="note" 
                    value={formData.note}
                    onChange={e => setFormData({...formData, note: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Simpan Entry</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-slate-200/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Proyek</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead className="text-right">Durasi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Belum ada data timesheet.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.project}</TableCell>
                    <TableCell>{entry.activity}</TableCell>
                    <TableCell className="text-right">{entry.duration}h</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
