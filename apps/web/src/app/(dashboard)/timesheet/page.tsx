'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar as CalendarIcon, Download, Plus, Trash2, CheckCircle2, Circle, Clock, FileSpreadsheet } from 'lucide-react'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

export default function TimesheetPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  
  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '18:00',
    activity: '',
    duration: 8,
    project: ''
  })
  
  // Export State
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  useEffect(() => {
    fetchEntries()
    fetchTemplates()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const res = await api.get('/timesheet')
    if (res.success) {
      setEntries(res.data)
    }
    setLoading(false)
  }

  const fetchTemplates = async () => {
    const res = await api.get('/clients')
    if (res.success) {
      setTemplates(res.data)
      if (res.data.length > 0) {
        // Cari yang default, jika tidak ada pakai yang pertama
        const defaultTpl = res.data.find((t: any) => t.isDefault)
        setSelectedTemplateId(defaultTpl ? defaultTpl.id : res.data[0].id)
      }
    }
  }

  const handleCreateEntry = async () => {
    const res = await api.post('/timesheet', formData)
    if (res.success) {
      toast.success('Timesheet berhasil ditambahkan')
      setIsDialogOpen(false)
      fetchEntries()
      setFormData({
        ...formData,
        activity: '',
        project: ''
      })
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Hapus entri ini?')) return
    const res = await api.delete(`/timesheet/${id}`)
    if (res.success) {
      toast.success('Entri dihapus')
      fetchEntries()
    }
  }

  const handleExport = async () => {
    if (!selectedTemplateId) {
      toast.error('Silakan pilih template terlebih dahulu di Settings')
      return
    }
    
    try {
      toast.loading('Menyiapkan laporan...')
      const res = await api.downloadBlob('/timesheet/export-client', {
        month: exportMonth,
        clientId: selectedTemplateId
      })
      
      const url = window.URL.createObjectURL(res)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Timesheet_${exportMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.dismiss()
      toast.success('Laporan berhasil diunduh')
      setIsExportOpen(false)
    } catch (error: any) {
      toast.dismiss()
      const msg = error?.response?.data?.message || error?.message || 'Gagal mengunduh laporan'
      toast.error(msg, { duration: 5000 })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet</h2>
          <p className="text-slate-500">Kelola aktivitas harian dan ekspor laporan.</p>
        </div>
        
        <div className="flex gap-2">
          {/* DIALOG EXPORT */}
          <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
                <Download className="w-4 h-4" /> Export Excel
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  Ekspor Laporan
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Pilih Bulan</Label>
                  <Input 
                    type="month" 
                    value={exportMonth} 
                    onChange={(e) => setExportMonth(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pilih Template</Label>
                  <Select value={selectedTemplateId} onValueChange={(val) => setSelectedTemplateId(val || '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Format Template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.name} {tpl.user ? `(${tpl.user.name})` : '(General)'}
                        </SelectItem>
                      ))}
                      {templates.length === 0 && (
                        <SelectItem value="none" disabled>Belum ada template di Settings</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleExport} className="w-full">Unduh Sekarang</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DIALOG ADD ENTRY */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Tambah Aktivitas
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Aktivitas Baru</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Durasi (Jam)</Label>
                    <Input type="number" step="0.5" value={formData.duration} onChange={(e) => setFormData({...formData, duration: parseFloat(e.target.value)})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jam Mulai</Label>
                    <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Jam Selesai</Label>
                    <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Proyek</Label>
                  <Input placeholder="Nama Proyek (Opsional)" value={formData.project} onChange={(e) => setFormData({...formData, project: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Aktivitas</Label>
                  <Input placeholder="Apa yang Anda kerjakan?" value={formData.activity} onChange={(e) => setFormData({...formData, activity: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateEntry} className="w-full">Simpan Aktivitas</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Entri</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Jam</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.reduce((acc, curr) => acc + curr.duration, 0)} Jam
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Bulan Ini</CardTitle>
            <CalendarIcon className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.filter(e => format(new Date(e.date), 'yyyy-MM') === format(new Date(), 'yyyy-MM')).length} Entri
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Riwayat Aktivitas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-6 py-3">Waktu</th>
                  <th className="px-6 py-3">Aktivitas</th>
                  <th className="px-6 py-3">Durasi</th>
                  <th className="px-6 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="bg-white border-b hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      {entry.startTime} - {entry.endTime}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{entry.activity}</div>
                      <div className="text-xs text-slate-400">{entry.project}</div>
                    </td>
                    <td className="px-6 py-4">{entry.duration} Jam</td>
                    <td className="px-6 py-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">
                      Belum ada data aktivitas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
