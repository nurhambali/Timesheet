'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Plus, Download, Trash2, Calendar as CalendarIcon, FileSpreadsheet, Pencil, X, Save, Clock, FileText, Sparkles } from 'lucide-react'
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from '@/components/ui/textarea'

export default function TimesheetPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [showProject, setShowProject] = useState(false)
  
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '18:00',
    activity: '',
    duration: 9,
    project: 'Personal'
  })

  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [exportData, setExportData] = useState({
    month: format(new Date(), 'yyyy-MM'),
  })

  useEffect(() => {
    fetchEntries()
    fetchTemplates()
    const saved = localStorage.getItem('showProjectField')
    setShowProject(saved === 'true')
  }, [])

  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      try {
        const start = parse(formData.startTime, 'HH:mm', new Date())
        const end = parse(formData.endTime, 'HH:mm', new Date())
        let diff = differenceInMinutes(end, start)
        if (diff < 0) diff += 24 * 60
        const hours = parseFloat((diff / 60).toFixed(1))
        setFormData(prev => ({ ...prev, duration: hours }))
      } catch (e) {}
    }
  }, [formData.startTime, formData.endTime])

  const fetchEntries = async () => {
    const res = await api.get('/timesheet')
    if (res.success) setEntries(res.data)
  }

  const fetchTemplates = async () => {
    const res = await api.get('/clients')
    if (res.success) {
      setTemplates(res.data)
      if (res.data.length > 0) {
        const defaultTpl = res.data.find((t: any) => t.isDefault)
        setSelectedTemplateId(defaultTpl ? defaultTpl.id : res.data[0].id)
      }
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await api.post('/timesheet', formData)
    if (res.success) {
      toast.success('Entry berhasil ditambahkan')
      setIsCreateOpen(false)
      setFormData({ date: format(new Date(), 'yyyy-MM-dd'), startTime: '09:00', endTime: '18:00', activity: '', duration: 9, project: 'Personal' })
      fetchEntries()
    }
    setLoading(false)
  }

  const openEditModal = (entry: any) => {
    setEditingEntry(entry)
    setFormData({
      date: format(new Date(entry.date), 'yyyy-MM-dd'),
      startTime: entry.startTime || '09:00',
      endTime: entry.endTime || '18:00',
      activity: entry.activity || '',
      duration: entry.duration || 9,
      project: entry.project || 'Personal'
    })
    setIsEditOpen(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntry) return
    setLoading(true)
    const res = await api.put(`/timesheet/${editingEntry.id}`, formData)
    if (res.success) {
      toast.success('Data berhasil diperbarui')
      setIsEditOpen(false)
      fetchEntries()
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data ini?')) return
    const res = await api.delete(`/timesheet/${id}`)
    if (res.success) {
      toast.success('Data dihapus'); fetchEntries()
    }
  }

  const handleExport = async () => {
    toast.loading('Menyiapkan laporan...')
    try {
      const filename = `Timesheet_Report_${exportData.month}.xlsx`
      await api.downloadBlob('/timesheet/export-client', {
        month: exportData.month,
        clientId: selectedTemplateId
      }, filename)
      toast.dismiss(); toast.success('Laporan berhasil diunduh'); setIsExportOpen(false)
    } catch (error: any) {
      toast.dismiss()
      toast.error('Gagal mengunduh laporan')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet</h2>
          <p className="text-slate-500">Kelola aktivitas harian Anda.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DialogTrigger render={(props) => (
              <Button {...props} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Export Excel
              </Button>
            )} />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Export Laporan Excel</DialogTitle>
                <DialogDescription>Pilih bulan dan template yang akan digunakan.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Pilih Bulan</Label>
                  <Input type="month" value={exportData.month} onChange={(e) => setExportData({...exportData, month: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Pilih Template</Label>
                  <Select value={selectedTemplateId} onValueChange={(val) => setSelectedTemplateId(val || '')}>
                    <SelectTrigger><SelectValue placeholder="Pilih Template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.isDefault ? '(Default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExport} className="w-full gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Unduh Sekarang
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger render={(props) => (
              <Button {...props} className="gap-2">
                <Plus className="w-4 h-4" /> Tambah Data
              </Button>
            )} />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Tambah Aktivitas Baru</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal</Label>
                    <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label>Durasi (Jam)</Label>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold animate-pulse">
                        <Sparkles className="w-2.5 h-2.5" /> AUTO
                      </span>
                    </div>
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.duration} 
                      readOnly 
                      className="bg-slate-50 font-bold text-blue-600 border-blue-100 cursor-not-allowed" 
                      required 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mulai</Label>
                    <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Selesai</Label>
                    <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
                  </div>
                </div>
                {showProject && (
                   <div className="space-y-2">
                    <Label>Project</Label>
                    <Input value={formData.project} onChange={(e) => setFormData({...formData, project: e.target.value})} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Aktivitas</Label>
                  <Textarea 
                    placeholder="Apa yang Anda kerjakan hari ini?" 
                    value={formData.activity} 
                    onChange={(e) => setFormData({...formData, activity: e.target.value})}
                    className="min-h-[120px] resize-none"
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Menyimpan...' : 'Simpan Aktivitas'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200/50">
        <CardHeader><CardTitle className="text-lg">Daftar Aktivitas</CardTitle></CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  {showProject && <th className="px-4 py-3 font-semibold">Project</th>}
                  <th className="px-4 py-3 font-semibold">Waktu</th>
                  <th className="px-4 py-3 font-semibold">Jam</th>
                  <th className="px-4 py-3 font-semibold">Aktivitas</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => (
                  <tr key={entry.id} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap font-medium">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </td>
                    {showProject && <td className="px-4 py-4">{entry.project}</td>}
                    <td className="px-4 py-4 text-slate-500">{entry.startTime} - {entry.endTime}</td>
                    <td className="px-4 py-4">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">{entry.duration}h</span>
                    </td>
                    <td className="px-4 py-4 max-w-md">
                      <p className="line-clamp-2 text-slate-600 leading-relaxed">{entry.activity}</p>
                    </td>
                    <td className="px-4 py-4 text-right space-x-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5" onClick={() => openEditModal(entry)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-primary" /> Edit Aktivitas</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Durasi (Jam)</Label>
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold animate-pulse">
                    <Sparkles className="w-2.5 h-2.5" /> AUTO
                  </span>
                </div>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={formData.duration} 
                  readOnly 
                  className="bg-slate-50 font-bold text-blue-600 border-blue-100 cursor-not-allowed" 
                  required 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mulai</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input type="time" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>
            {showProject && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Input value={formData.project} onChange={(e) => setFormData({...formData, project: e.target.value})} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Aktivitas</Label>
              <Textarea 
                placeholder="Apa yang Anda kerjakan hari ini?" 
                value={formData.activity} 
                onChange={(e) => setFormData({...formData, activity: e.target.value})}
                className="min-h-[150px] resize-none focus:ring-primary"
                required 
              />
            </div>
            <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>Batal</Button>
                <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                    <Save className="w-4 h-4" /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
