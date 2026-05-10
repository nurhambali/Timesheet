'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Briefcase, Calendar, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalHours: 0,
    projectCount: 0,
    entriesThisMonth: 0,
  })

  useEffect(() => {
    async function fetchStats() {
      const response = await api.get('/timesheet')
      if (response.success) {
        const entries = response.data
        const projects = new Set(entries.map((e: any) => e.project))
        const total = entries.reduce((acc: number, e: any) => acc + e.duration, 0)
        
        setStats({
          totalHours: total,
          projectCount: projects.size,
          entriesThisMonth: entries.length,
        })
      }
    }
    fetchStats()
  }, [])

  const cards = [
    { title: 'Total Jam', value: `${stats.totalHours}h`, icon: Clock, color: 'text-blue-500' },
    { title: 'Proyek Aktif', value: stats.projectCount, icon: Briefcase, color: 'text-green-500' },
    { title: 'Entry Bulan Ini', value: stats.entriesThisMonth, icon: Calendar, color: 'text-purple-500' },
    { title: 'Efisiensi', value: '+12%', icon: TrendingUp, color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-slate-500">Selamat datang kembali! Berikut ringkasan aktivitas Anda.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm border-slate-200/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Ringkasan Aktivitas Mingguan</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-slate-400 italic">
            Fitur grafik akan muncul di sini setelah ada data yang cukup.
          </CardContent>
        </Card>
        
        <Card className="col-span-3 shadow-sm border-slate-200/50">
          <CardHeader>
            <CardTitle>Proyek Teratas</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                <p className="text-sm text-slate-500 italic">Belum ada data proyek terbaru.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
