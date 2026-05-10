'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Plus, Trash2, Upload, FileSpreadsheet, Settings2, X, Check, ArrowRight, User as UserIcon, Star, Table as TableIcon, Info, Sparkles } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState({
    TELEGRAM_BOT_TOKEN: '',
  })
  const [loading, setLoading] = useState(false)
  const [telegramData, setTelegramData] = useState<{telegramToken?: string, telegramId?: string, telegramUsername?: string} | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Template Management State
  const [templates, setTemplates] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [newTemplateName, setNewTemplateName] = useState('')
  const [assignUserId, setAssignUserId] = useState<string>('all')
  const [templateLoading, setTemplateLoading] = useState(false)
  
  // Mapping Editor State
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [mapping, setMapping] = useState<any>({
    name: 'C2',
    period: 'I3',
    startDateCell: '',
    endDateCell: '',
    startRow: 10,
    dateCol: 'A',
    startCol: 'C',
    endCol: 'E',
    durationCol: 'F',
    activityCol: 'G'
  })

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      
      if (parsedUser.role === 'ADMIN') {
        fetchSettings()
        fetchUsers()
      }
      fetchTelegramToken()
      fetchTemplates()
    }
  }, [])

  const fetchSettings = async () => {
    const res = await api.get('/settings')
    if (res.success && res.data) {
      setSettings(prev => ({ ...prev, ...res.data }))
    }
  }

  const fetchUsers = async () => {
    const res = await api.get('/clients/users')
    if (res.success) {
      setUsers(res.data)
    }
  }

  const fetchTelegramToken = async () => {
    const res = await api.get('/user/telegram-token')
    if (res.success) {
      setTelegramData(res.data)
    }
  }

  const fetchTemplates = async () => {
    const res = await api.get('/clients')
    if (res.success) {
      setTemplates(res.data)
    }
  }

  const generateToken = async () => {
    setTokenLoading(true)
    const res = await api.post('/user/telegram-token', {})
    if (res.success) {
      setTelegramData(prev => ({ ...prev, telegramToken: res.data.telegramToken }))
      toast.success('Kode aktivasi baru berhasil dibuat')
    }
    setTokenLoading(false)
  }

  const saveSettings = async () => {
    setLoading(true)
    const res = await api.post('/settings', settings)
    if (res.success) {
      toast.success('Pengaturan berhasil disimpan')
    } else {
      toast.error('Gagal menyimpan pengaturan')
    }
    setLoading(false)
  }

  const handleAddTemplate = async () => {
    if (!newTemplateName) return
    setTemplateLoading(true)
    const res = await api.post('/clients', { 
      name: newTemplateName,
      userId: assignUserId === 'all' ? null : assignUserId
    })
    if (res.success) {
      toast.success('Template berhasil ditambahkan')
      setNewTemplateName('')
      setAssignUserId('all')
      fetchTemplates()
    } else {
      toast.error(res.message)
    }
    setTemplateLoading(false)
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Peringatan: Menghapus template ini akan menghapus semua file terkait. Lanjutkan?')) return
    const res = await api.delete(`/clients/${id}`)
    if (res.success) {
      toast.success('Template berhasil dihapus')
      fetchTemplates()
    }
  }

  const handleSetDefault = async (id: string) => {
    const res = await api.post(`/clients/${id}/set-default`, {})
    if (res.success) {
      toast.success('Template default diperbarui')
      fetchTemplates()
    }
  }

  const handleUploadFile = async (template: any, file: File) => {
    setUploading(true)
    const res = await api.uploadFile(`/clients/${template.id}/template`, file)
    if (res.success) {
      toast.success(`File template untuk ${template.name} berhasil diupload!`)
      await fetchTemplates()
      openMappingEditor(template)
    } else {
      toast.error(res.message)
    }
    setUploading(false)
  }

  const openMappingEditor = async (template: any) => {
    setEditingTemplate(template)
    setPreviewData([])
    
    if (template.mapping) {
      try {
        const parsedMapping = JSON.parse(template.mapping)
        setMapping({
            name: 'C2',
            period: 'I3',
            startDateCell: '',
            endDateCell: '',
            startRow: 10,
            dateCol: 'A',
            startCol: 'C',
            endCol: 'E',
            durationCol: 'F',
            activityCol: 'G',
            ...parsedMapping
        })
      } catch (e) {}
    } else {
      setMapping({
        name: 'C2',
        period: 'I3',
        startDateCell: '',
        endDateCell: '',
        startRow: 10,
        dateCol: 'A',
        startCol: 'C',
        endCol: 'E',
        durationCol: 'F',
        activityCol: 'G'
      })
    }

    if (template.templateFile) {
      setPreviewLoading(true)
      const res = await api.get(`/clients/${template.id}/preview`)
      if (res.success) {
        setPreviewData(res.data)
      }
      setPreviewLoading(false)
    }
  }

  const saveMapping = async () => {
    if (!editingTemplate) return
    const res = await api.put(`/clients/${editingTemplate.id}/mapping`, { 
      mapping,
      name: editingTemplate.name,
      userId: editingTemplate.userId
    })
    if (res.success) {
      toast.success('Konfigurasi berhasil disimpan')
      setEditingTemplate(null)
      fetchTemplates()
    } else {
      toast.error('Gagal menyimpan konfigurasi')
    }
  }

  const updateTemplateField = (field: string, value: any) => {
    setEditingTemplate((prev: any) => ({ ...prev, [field]: value }))
  }

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN'

  // Helper untuk mencari sel di preview data
  const getPreviewCols = () => {
    if (previewData.length === 0) return []
    return Object.keys(previewData[0]).filter(k => k !== '_row').sort()
  }

  return (
    <div className="space-y-6 relative">
      {/* MODAL MAPPING & ASSIGNMENT */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl max-h-[95vh] shadow-2xl border-primary/20 animate-in zoom-in duration-300 flex flex-col">
            <CardHeader className="bg-white border-b shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Konfigurasi Template: {editingTemplate.name}</CardTitle>
                    <CardDescription>Sesuaikan detail dan pemetaan variabel sel Excel.</CardDescription>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditingTemplate(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* PANEL KIRI: PREVIEW EXCEL */}
              <div className="flex-1 bg-slate-100 border-r overflow-hidden flex flex-col p-4">
                <div className="flex items-center gap-2 mb-3 text-slate-600">
                  <TableIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Preview File Excel</span>
                </div>
                
                <div className="flex-1 bg-white rounded-lg border shadow-inner overflow-auto relative">
                  {previewLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-slate-500 font-medium">Membaca file...</p>
                      </div>
                    </div>
                  ) : previewData.length > 0 ? (
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-200">
                          <th className="border-r border-b p-1 w-8 text-slate-400 bg-slate-50">#</th>
                          {getPreviewCols().map(col => (
                            <th key={col} className="border-r border-b p-2 font-bold text-slate-700 min-w-[100px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row) => (
                          <tr key={row._row} className="hover:bg-blue-50/50 transition-colors">
                            <td className="border-r border-b p-1 text-center bg-slate-50 text-slate-400 font-mono">
                              {row._row}
                            </td>
                            {getPreviewCols().map(col => {
                              const cellAddr = `${col}${row._row}`
                              const isHeaderMapped = mapping.name === cellAddr || mapping.period === cellAddr || mapping.startDateCell === cellAddr || mapping.endDateCell === cellAddr
                              const isColMapped = mapping.dateCol === col || mapping.startCol === col || mapping.endCol === col || mapping.durationCol === col || mapping.activityCol === col
                              const isRowActive = row._row >= mapping.startRow
                              
                              return (
                                <td 
                                  key={col} 
                                  className={`border-r border-b p-2 truncate max-w-[150px] relative group
                                    ${isHeaderMapped ? 'bg-orange-100 ring-2 ring-orange-400 z-1' : ''}
                                    ${isColMapped && isRowActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''}
                                  `}
                                >
                                  {row[col]}
                                  {isHeaderMapped && (
                                    <span className="absolute -top-1 -right-1 bg-orange-500 text-[8px] text-white px-1 rounded-full shadow-sm font-bold uppercase">
                                      Map
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                        <FileSpreadsheet className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Belum ada file template diupload</p>
                        <p className="text-xs text-slate-400 mt-1">Upload file .xlsx terlebih dahulu untuk melihat preview grid di sini.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PANEL KANAN: FORM MAPPING */}
              <div className="w-full md:w-[420px] overflow-y-auto p-6 space-y-8 bg-white">
                {/* Section 1: Header Mapping */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Mapping Header</h3>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold text-slate-600">Sel Nama Karyawan</Label>
                        <span className="text-[10px] text-slate-400 italic">Contoh: C2</span>
                      </div>
                      <Input 
                        value={mapping.name} 
                        onChange={(e) => setMapping({...mapping, name: e.target.value.toUpperCase()})}
                        className="font-mono uppercase h-9 border-slate-200 focus:ring-orange-400" 
                      />
                      <div className="flex items-start gap-1.5 p-2 bg-orange-50 rounded border border-orange-100">
                        <Sparkles className="w-3.5 h-3.5 text-orange-500 mt-0.5" />
                        <p className="text-[10px] text-orange-700 leading-tight">
                          <b>Smart Replace:</b> Jika sel berisi titik-titik (misal: "Nama : ...."), sistem hanya akan mengganti titik-titiknya saja.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode Laporan</Label>
                        
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <Label className="text-[11px] text-slate-600">Gabungan (Satu Sel)</Label>
                                <span className="text-[9px] text-slate-400">Contoh: I3</span>
                            </div>
                            <Input 
                                value={mapping.period} 
                                onChange={(e) => setMapping({...mapping, period: e.target.value.toUpperCase(), startDateCell: '', endDateCell: ''})}
                                placeholder="I3"
                                className="font-mono uppercase h-8 border-slate-200" 
                            />
                        </div>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                            <div className="relative flex justify-center text-[9px] uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Atau Terpisah</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-slate-600">Tgl Mulai</Label>
                                <Input 
                                    value={mapping.startDateCell} 
                                    onChange={(e) => setMapping({...mapping, startDateCell: e.target.value.toUpperCase(), period: ''})}
                                    placeholder="I3"
                                    className="font-mono uppercase h-8 border-slate-200" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-slate-600">Tgl Selesai</Label>
                                <Input 
                                    value={mapping.endDateCell} 
                                    onChange={(e) => setMapping({...mapping, endDateCell: e.target.value.toUpperCase(), period: ''})}
                                    placeholder="K3"
                                    className="font-mono uppercase h-8 border-slate-200" 
                                />
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Table Column Mapping */}
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Mapping Tabel Data</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Mulai Isi Data Pada Baris Ke</Label>
                      <Input 
                        type="number" 
                        value={mapping.startRow} 
                        onChange={(e) => setMapping({...mapping, startRow: parseInt(e.target.value)})} 
                        className="h-9 border-slate-200"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Kolom Tgl</Label>
                        <Input value={mapping.dateCol} onChange={(e) => setMapping({...mapping, dateCol: e.target.value.toUpperCase()})} className="text-center font-mono uppercase h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Kolom Jam</Label>
                        <Input value={mapping.durationCol} onChange={(e) => setMapping({...mapping, durationCol: e.target.value.toUpperCase()})} className="text-center font-mono uppercase h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Kolom Mulai</Label>
                        <Input value={mapping.startCol} onChange={(e) => setMapping({...mapping, startCol: e.target.value.toUpperCase()})} className="text-center font-mono uppercase h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Kolom Selesai</Label>
                        <Input value={mapping.endCol} onChange={(e) => setMapping({...mapping, endCol: e.target.value.toUpperCase()})} className="text-center font-mono uppercase h-9" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Kolom Aktivitas / Keterangan</Label>
                      <Input value={mapping.activityCol} onChange={(e) => setMapping({...mapping, activityCol: e.target.value.toUpperCase()})} className="font-mono uppercase h-9" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex gap-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="text-[10px] text-blue-700 leading-relaxed">
                    Lihat panel preview di samping kiri. Mapping Header akan berwarna Oranye, dan Mapping Tabel akan berwarna Biru.
                  </p>
                </div>
              </div>
            </div>

            <CardFooter className="bg-slate-50 p-6 border-t flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                {isAdmin && (
                   <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">Assign User:</Label>
                    <Select 
                      value={editingTemplate.userId || 'all'} 
                      onValueChange={(val) => updateTemplateField('userId', val === 'all' ? null : val)}
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua User / General</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                   </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>Batal</Button>
                <Button onClick={saveMapping} className="px-8 gap-2 shadow-lg shadow-primary/20">
                  <Check className="w-4 h-4" /> Simpan Konfigurasi
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-slate-500">Konfigurasi preferensi dan manajemen template.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle>Daftar Template</CardTitle>
                <CardDescription>Kelola file master Excel untuk laporan.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 p-4 bg-slate-50 border rounded-xl">
                <Label className="text-xs font-bold text-slate-500 uppercase">Tambah Template Baru</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input 
                    placeholder="Nama Template (misal: Laporan Bulanan)" 
                    value={newTemplateName} 
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="flex-1"
                  />
                  {isAdmin && (
                    <Select value={assignUserId} onValueChange={(val) => setAssignUserId(val || 'all')}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Assign Ke..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua User</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={handleAddTemplate} disabled={templateLoading || !newTemplateName} className="gap-2">
                    <Plus className="w-4 h-4" /> Tambah
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {templates.map((tpl) => (
                  <div key={tpl.id} className={`p-4 border rounded-xl flex items-center justify-between transition-all group ${tpl.isDefault ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-white hover:border-primary/30'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tpl.templateFile ? (tpl.isDefault ? 'bg-primary text-white' : 'bg-green-100 text-green-600') : 'bg-slate-100 text-slate-400'}`}>
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{tpl.name}</span>
                          {tpl.isDefault && <span className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">Default</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {tpl.user ? (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <UserIcon className="w-2.5 h-2.5" /> {tpl.user.name}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">General</span>
                          )}
                          {!tpl.templateFile && <span className="text-[10px] text-red-500 italic">File Kosong</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className={`h-9 w-9 ${tpl.isDefault ? 'text-primary' : 'text-slate-400 hover:text-primary'}`} title="Set as Default" onClick={() => handleSetDefault(tpl.id)}>
                        <Star className={`w-4 h-4 ${tpl.isDefault ? 'fill-primary' : ''}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-600 hover:bg-slate-100" title="Config Mapping" onClick={() => openMappingEditor(tpl)}>
                        <Settings2 className="w-4 h-4" />
                      </Button>
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept=".xlsx"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadFile(tpl, file)
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:bg-blue-50">
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="text-center py-10 border-2 border-dashed rounded-xl border-slate-100 text-slate-400">
                    <p className="text-sm">Belum ada template yang terdaftar.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200/50">
            <CardHeader>
              <CardTitle>Integrasi Telegram</CardTitle>
              <CardDescription>Hubungkan akun Anda untuk input via chat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {telegramData?.telegramId ? (
                <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Akun Terhubung</p>
                    <p className="text-sm text-green-600">
                      Telegram: {telegramData.telegramUsername ? `@${telegramData.telegramUsername.replace('@', '')}` : `ID: ${telegramData.telegramId}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Langkah-langkah menghubungkan:</p>
                  <ol className="text-sm text-slate-500 space-y-2 list-decimal pl-4">
                    <li>Generate kode aktivasi di bawah.</li>
                    <li>Cari bot di Telegram.</li>
                    <li>Kirim pesan: <code>/start &lt;KODE&gt;</code></li>
                  </ol>
                  
                  {telegramData?.telegramToken ? (
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Kode Aktivasi Anda</p>
                      <p className="text-3xl font-mono font-bold text-primary tracking-widest">{telegramData.telegramToken}</p>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={generateToken} disabled={tokenLoading}>
                      {tokenLoading ? 'Generating...' : 'Buat Kode Aktivasi'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="shadow-sm border-slate-200/50 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Konfigurasi Sistem (Admin)</CardTitle>
                <CardDescription>Pengaturan bot Telegram.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bot-token">Telegram Bot Token</Label>
                  <Input 
                    id="bot-token" 
                    type="password"
                    placeholder="Dapatkan dari @BotFather" 
                    value={settings.TELEGRAM_BOT_TOKEN}
                    onChange={(e) => setSettings({...settings, TELEGRAM_BOT_TOKEN: e.target.value})}
                    className="bg-white"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={saveSettings} disabled={loading}>
                  {loading ? 'Simpan Perubahan' : 'Simpan Perubahan'}
                </Button>
              </CardFooter>
            </Card>
          )}

          <Card className="shadow-sm border-slate-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" /> Kustomisasi & Field
              </CardTitle>
              <CardDescription>Pilih kolom yang ingin Anda tampilkan di Timesheet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Kolom Project</Label>
                    <p className="text-[11px] text-slate-500">Tampilkan input Project di form dan tabel timesheet.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant={localStorage.getItem('showProjectField') === 'true' ? 'default' : 'outline'}
                      onClick={() => {
                        const current = localStorage.getItem('showProjectField') === 'true';
                        localStorage.setItem('showProjectField', (!current).toString());
                        toast.success(`Kolom Project ${!current ? 'diaktifkan' : 'disembunyikan'}`);
                        window.location.reload(); // Reload untuk apply perubahan ke semua komponen
                      }}
                    >
                      {localStorage.getItem('showProjectField') === 'true' ? 'Aktif' : 'Nonaktif'}
                    </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
