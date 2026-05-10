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

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      
      if (parsedUser.role === 'ADMIN') {
        fetchSettings()
      }
    }
  }, [])

  const fetchSettings = async () => {
    const res = await api.get('/settings')
    if (res.success && res.data) {
      setSettings(prev => ({ ...prev, ...res.data }))
    }
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

      <div className="grid gap-6">
        {user?.role === 'ADMIN' && (
          <Card className="shadow-sm border-slate-200/50 border-primary/20">
            <CardHeader>
              <CardTitle>Konfigurasi Sistem (Admin)</CardTitle>
              <CardDescription>Pengaturan rahasia untuk fungsionalitas sistem.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-token">Telegram Bot Token</Label>
                <Input 
                  id="bot-token" 
                  type="password"
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" 
                  value={settings.TELEGRAM_BOT_TOKEN}
                  onChange={(e) => setSettings({...settings, TELEGRAM_BOT_TOKEN: e.target.value})}
                />
                <p className="text-xs text-slate-500">Dapatkan token dari @BotFather di Telegram.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveSettings} disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </Button>
            </CardFooter>
          </Card>
        )}

        <Card className="shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Notifikasi Pribadi</CardTitle>
            <CardDescription>Atur bagaimana Anda menerima pengingat timesheet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="email-notif" className="flex flex-col space-y-1">
                <span>Email Notifikasi</span>
                <span className="font-normal text-slate-500">Kirim rekap mingguan ke email saya.</span>
              </Label>
              <Switch id="email-notif" />
            </div>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="telegram-notif" className="flex flex-col space-y-1">
                <span>Telegram Bot</span>
                <span className="font-normal text-slate-500">Terima pengingat harian via Telegram.</span>
              </Label>
              <Switch id="telegram-notif" checked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
