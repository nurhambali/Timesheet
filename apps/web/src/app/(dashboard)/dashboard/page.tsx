'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Calendar, FileText, LayoutDashboard, Download, User as UserIcon } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { format } from 'date-fns'

export default function DashboardPage() {
  const [allEntries, setAllEntries] = useState([])
  const [holidays, setHolidays] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState('') 
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [showProject, setShowProject] = useState(false)

  const fetchEntries = async () => {
    const [timesheetRes, holidayRes] = await Promise.all([
      api.get('/timesheet'),
      api.get('/holiday')
    ])

    if (holidayRes.success) setHolidays(holidayRes.data)

    if (timesheetRes.success) {
      const data = timesheetRes.data
      setAllEntries(data)

      const months = new Set<string>()
      data.forEach((e: any) => {
        const d = new Date(e.date)
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.add(yearMonth)
      })
      
      const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a))
      setAvailableMonths(sortedMonths)
      
      if (sortedMonths.length > 0 && !selectedMonth) {
        setSelectedMonth(sortedMonths[0])
      }
    }
  }

  useEffect(() => {
    fetchEntries()
    const saved = localStorage.getItem('showProjectField')
    setShowProject(saved === 'true')
  }, [])

  const filteredEntries = allEntries.filter((e: any) => {
    if (!selectedMonth || selectedMonth === 'All') return true
    const d = new Date(e.date)
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return yearMonth === selectedMonth
  })

  const stats = {
    totalHours: filteredEntries.reduce((acc: number, e: any) => {
      const d = new Date(e.date)
      const isWeekend = d.getDay() === 0 || d.getDay() === 6
      const isHoliday = holidays.some((h: any) => h.date.split('T')[0] === e.date.split('T')[0])
      if (isWeekend || isHoliday) return acc
      return acc + e.duration
    }, 0),
    entriesCount: filteredEntries.length,
  }

  const [pageSize, setPageSize] = useState<number | 'All'>(30)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, pageSize])

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredEntries.length / pageSize)
  const paginatedEntries = pageSize === 'All' 
    ? filteredEntries 
    : filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    const userData = localStorage.getItem('user')
    const userName = userData ? JSON.parse(userData).name : 'User'
    const safeName = userName.replace(/\s+/g, '_')

    let csvContent = 'Date,Project,Start,End,Duration,Activity\n'
    filteredEntries.forEach((entry: any) => {
      const date = new Date(entry.date).toLocaleDateString('en-GB')
      const project = `"${(entry.project || '').replace(/"/g, '""')}"`
      const start = entry.startTime || '-'
      const end = entry.endTime || '-'
      const duration = entry.duration
      const activity = `"${entry.activity.replace(/"/g, '""')}"` 
      csvContent += `${date},${project},${start},${end},${duration},${activity}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Timesheet_${safeName}_${selectedMonth || 'All'}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Berhasil mengekspor CSV')
  }

  const formatMonthLabel = (ym: string) => {
    if (!ym || ym === 'All') return 'Semua Data'
    const [y, m] = ym.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, 1)
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  const cards = [
    { title: 'Total Jam Kerja', value: `${stats.totalHours.toFixed(1)}h`, description: 'Bulan terpilih (diluar weekend/libur)', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Total Aktivitas', value: stats.entriesCount, description: 'Jumlah baris data tercatat', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <LayoutDashboard className="w-6 h-6 text-primary" />
             <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          </div>
          <p className="text-slate-500">Ringkasan aktivitas dan performa kerja Anda.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-slate-500 uppercase">Periode:</Label>
            <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val || 'All')}>
              <SelectTrigger className="w-[200px] h-10 bg-white">
                <SelectValue placeholder="Semua Data" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Semua Data</SelectItem>
                {availableMonths.map(ym => (
                  <SelectItem key={ym} value={ym}>{formatMonthLabel(ym)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleExportCSV} className="gap-2 bg-white shadow-sm hover:bg-slate-50 transition-all active:scale-95">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm border-slate-200/50 overflow-hidden group hover:border-primary/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg} group-hover:scale-110 transition-transform`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="text-[10px] text-slate-400 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm border-slate-200/50 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b p-4">
           <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-400" /> Daftar Aktivitas Terkini
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Limit:</Label>
                  <Select 
                    value={String(pageSize)} 
                    onValueChange={(val) => {
                      setPageSize(val === 'All' ? 'All' : Number(val))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[80px] h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="All">Semua</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30 hover:bg-transparent">
                  <TableHead className="w-[150px] font-bold text-slate-700">Tanggal</TableHead>
                  {showProject && <TableHead className="w-[150px] font-bold text-slate-700">Project</TableHead>}
                  <TableHead className="w-[180px] font-bold text-slate-700">Waktu</TableHead>
                  <TableHead className="w-[100px] font-bold text-slate-700 text-center">Durasi</TableHead>
                  <TableHead className="font-bold text-slate-700">Aktivitas / Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showProject ? 5 : 4} className="text-center py-12 text-slate-400 italic">
                      Tidak ada data aktivitas untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEntries.map((entry: any) => (
                    <TableRow key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-medium">
                        {format(new Date(entry.date), 'dd MMM yyyy')}
                      </TableCell>
                      {showProject && (
                        <TableCell>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-semibold">
                            {entry.project || 'General'}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-slate-500 font-mono text-xs">
                        {entry.startTime || '-'} — {entry.endTime || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">
                          {entry.duration}h
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-slate-600 text-sm leading-relaxed">
                          {entry.activity}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pageSize !== 'All' && totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium">
                Menampilkan halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
