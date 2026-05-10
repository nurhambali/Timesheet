'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [settings, setSettings] = useState({
    TELEGRAM_BOT_TOKEN: '',
  })
  const [loading, setLoading] = useState(false)
  const [telegramData, setTelegramData] = useState<{telegramToken?: string, telegramId?: string} | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      
      if (parsedUser.role === 'ADMIN') {
        fetchSettings()
      }
      fetchTelegramToken()
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-slate-500">Konfigurasi preferensi aplikasi Anda.</p>
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
                  
                  {telegramData?.telegramToken && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={generateToken}>
                      Ganti Kode Baru
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200/50">
            <CardHeader>
              <CardTitle>Notifikasi Pribadi</CardTitle>
              <CardDescription>Atur bagaimana Anda menerima pengingat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="email-notif" className="flex flex-col space-y-1">
                  <span>Email Notifikasi</span>
                  <span className="font-normal text-slate-500">Kirim rekap mingguan ke email.</span>
                </Label>
                <Switch id="email-notif" />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="telegram-notif" className="flex flex-col space-y-1">
                  <span>Telegram Bot</span>
                  <span className="font-normal text-slate-500">Terima pengingat harian.</span>
                </Label>
                <Switch id="telegram-notif" checked />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {user?.role === 'ADMIN' && (
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
        </div>
      </div>
    </div>
  )
}
