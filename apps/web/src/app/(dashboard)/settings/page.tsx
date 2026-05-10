'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-slate-500">Konfigurasi preferensi aplikasi Anda.</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Notifikasi</CardTitle>
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

        <Card className="shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Tampilan</CardTitle>
            <CardDescription>Kustomisasi antarmuka dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                <span>Dark Mode</span>
                <span className="font-normal text-slate-500">Gunakan tema gelap saat malam hari.</span>
              </Label>
              <Switch id="dark-mode" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
