'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Plus, Trash2, Upload, FileSpreadsheet } from 'lucide-react'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState({
    TELEGRAM_BOT_TOKEN: '',
  })
  const [loading, setLoading] = useState(false)
  const [telegramData, setTelegramData] = useState<{telegramToken?: string, telegramId?: string} | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // Client Management State
  const [clients, setClients] = useState<any[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [clientLoading, setClientLoading] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      
      if (parsedUser.role === 'ADMIN') {
        fetchSettings()
      }
      fetchTelegramToken()
      fetchClients()
    }
  }, [])

  const fetchSettings = async () => {
    const res = await api.get('/settings')
    if (res.success && res.data) {
      setSettings(prev => ({ ...prev, ...res.data }))
    }
  }

  const fetchTelegramToken = async () => {
    const res = await api.get('/user/telegram-token')
    if (res.success) {
      setTelegramData(res.data)
    }
  }

  const fetchClients = async () => {
    const res = await api.get('/clients')
    if (res.success) {
      setClients(res.data)
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

  const handleAddClient = async () => {
    if (!newClientName) return
    setClientLoading(true)
    const res = await api.post('/clients', { name: newClientName })
    if (res.success) {
      toast.success('Client berhasil ditambahkan')
      setNewClientName('')
      fetchClients()
    } else {
      toast.error(res.message)
    }
    setClientLoading(false)
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Hapus client ini? Template terkait juga akan dihapus.')) return
    const res = await api.delete(`/clients/${id}`)
    if (res.success) {
      toast.success('Client dihapus')
      fetchClients()
    }
  }

  const handleUploadClientTemplate = async (clientId: string, file: File) => {
    setUploading(true)
    const res = await api.uploadFile(`/clients/${clientId}/template`, file)
    if (res.success) {
      toast.success('Template client berhasil diperbarui')
      fetchClients()
    } else {
      toast.error(res.message)
    }
    setUploading(false)
  }

  const handleUploadGlobalTemplate = async () => {
    if (!templateFile) return
    setUploading(true)
    const res = await api.uploadFile('/settings/upload-template', templateFile)
    if (res.success) {
      toast.success('Template global berhasil diperbarui')
      setTemplateFile(null)
      const fileInput = document.getElementById('global-template') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } else {
      toast.error(res.message)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-slate-500">Konfigurasi preferensi dan template laporan.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                    <p className="text-sm text-green-600">Telegram ID: {telegramData.telegramId}</p>
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

          <Card className="shadow-sm border-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Daftar Client</CardTitle>
                <CardDescription>Kelola template khusus untuk setiap client.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Nama Client Baru..." 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                />
                <Button size="icon" onClick={handleAddClient} disabled={clientLoading || !newClientName}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="p-3 border rounded-lg flex items-center justify-between bg-slate-50/50 group">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{client.name}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {client.templateFile ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" /> Template Aktif
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Belum ada template</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept=".xlsx"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadClientTemplate(client.id, file)
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600">
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDeleteClient(client.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {clients.length === 0 && (
                  <p className="text-center py-4 text-sm text-slate-400 italic">Belum ada client terdaftar.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(user?.role?.toUpperCase() === 'ADMIN' || user?.role === 'ADMIN') && (
            <Card className="shadow-sm border-slate-200/50 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Konfigurasi Sistem (Admin)</CardTitle>
                <CardDescription>Pengaturan rahasia untuk sistem.</CardDescription>
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
                  {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                </Button>
              </CardFooter>
            </Card>
          )}

          <Card className="shadow-sm border-slate-200/50 border-green-200 bg-green-50/30">
            <CardHeader>
              <CardTitle>Global Master Template</CardTitle>
              <CardDescription>Fallback template jika client tidak punya template khusus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="global-template">File Master (.xlsx)</Label>
                <Input 
                  id="global-template" 
                  type="file" 
                  accept=".xlsx"
                  onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                  className="bg-white"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50" onClick={handleUploadGlobalTemplate} disabled={uploading || !templateFile}>
                {uploading ? 'Mengunggah...' : 'Update Template Global'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
