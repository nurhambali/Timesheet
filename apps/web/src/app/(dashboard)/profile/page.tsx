'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export default function ProfilePage() {
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    telegramId: '',
    password: '',
  })

  useEffect(() => {
    // 1. Muat data dari localStorage agar tampil instan
    const localData = localStorage.getItem('user')
    if (localData) {
      const parsed = JSON.parse(localData)
      setProfile(prev => ({
        ...prev,
        name: parsed.name || '',
        email: parsed.email || '',
        telegramId: parsed.telegramId || '',
      }))
    }
    
    // 2. Tarik data terbaru dari server
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const res = await api.get('/user/me')
    if (res.success && res.data) {
      setProfile({
        name: res.data.name || '',
        email: res.data.email || '',
        telegramId: res.data.telegramId || '',
        password: '', // Jangan isi password demi keamanan
      })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Hanya kirim password jika user mengetik sesuatu
    const payload: any = { ...profile }
    if (!payload.password) {
      delete payload.password
    }

    // Bersihkan simbol @ jika user tidak sengaja mengetiknya
    if (payload.telegramId) {
      payload.telegramId = payload.telegramId.replace('@', '').trim()
    }

    const res = await api.patch('/user/me', payload)
    
    if (res.success) {
      toast.success('Profil berhasil diperbarui!')
      // Update local storage user data
      localStorage.setItem('user', JSON.stringify(res.data))
      // Reset password field
      setProfile(prev => ({ ...prev, password: '' }))
      
      // Dispatch event to update sidebar
      window.dispatchEvent(new Event('storage'))
    } else {
      toast.error(res.message || 'Gagal memperbarui profil')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profil Saya</h2>
        <p className="text-slate-500">Kelola identitas, kredensial, dan pengaturan integrasi Anda.</p>
      </div>

      <form onSubmit={handleSave}>
        <Card className="shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Informasi Pribadi</CardTitle>
            <CardDescription>Perbarui nama dan email untuk akun ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input 
                id="name" 
                value={profile.name} 
                onChange={e => setProfile({...profile, name: e.target.value})} 
                required 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={profile.email} 
                onChange={e => setProfile({...profile, email: e.target.value})} 
                required 
              />
            </div>
            
            <hr className="my-4" />
            
            <div className="grid gap-2">
              <Label htmlFor="telegram">Telegram Username (Integrasi Bot)</Label>
              <Input 
                id="telegram" 
                placeholder="Contoh: hambali_dev (tanpa @)" 
                value={profile.telegramId} 
                onChange={e => setProfile({...profile, telegramId: e.target.value})} 
              />
              <p className="text-xs text-slate-500">
                Isi Username Telegram Anda di sini agar bot bisa mengenali Anda saat Anda mencatat timesheet via chat.
              </p>
            </div>

            <hr className="my-4" />

            <div className="grid gap-2">
              <Label htmlFor="password">Ganti Kata Sandi (Opsional)</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Biarkan kosong jika tidak ingin mengubah sandi" 
                value={profile.password} 
                onChange={e => setProfile({...profile, password: e.target.value})} 
              />
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/50 border-t justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
