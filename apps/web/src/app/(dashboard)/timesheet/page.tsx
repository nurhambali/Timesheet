'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Clock, CalendarIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export default function TimesheetPage() {
  const [allEntries, setAllEntries] = useState([])
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    duration: '',
    activity: '',
    note: '',
  })

  // Filter & Pagination States
  const [selectedMonth, setSelectedMonth] = useState('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [pageSize, setPageSize] = useState<number | 'All'>(30)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchEntries = async () => {
    const response = await api.get('/timesheet')
    if (response.success) {
      const data = response.data
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
  }, [])

  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const [startH, startM] = formData.startTime.split(':').map(Number)
      const [endH, endM] = formData.endTime.split(':').map(Number)
      
      let diffHours = (endH + endM / 60) - (startH + startM / 60)
      if (diffHours < 0) diffHours += 24 
      
      setFormData(prev => ({ ...prev, duration: diffHours.toFixed(1) }))
    }
  }, [formData.startTime, formData.endTime])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, pageSize])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await api.post('/timesheet', {
      ...formData,
      duration: parseFloat(formData.duration),
    })

    if (response.success) {
      toast.success('Berhasil menyimpan catatan waktu')
      setOpen(false)
      fetchEntries()
      setFormData({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        duration: '',
        activity: '',
        note: '',
      })
    } else {
      toast.error('Gagal menyimpan data')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      const response = await api.delete(`/timesheet/${id}`)
      if (response.success) {
        toast.success('Data dihapus')
        fetchEntries()
      }
    }
  }

  const filteredEntries = allEntries.filter((e: any) => {
    if (!selectedMonth) return true
    const d = new Date(e.date)
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return yearMonth === selectedMonth
  })

  // Pagination Logic
  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredEntries.length / pageSize)
  const paginatedEntries = pageSize === 'All' 
    ? filteredEntries 
    : filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error('Tidak ada data untuk diekspor')
      return
    }

    let csvContent = 'Date,Start,End,Total Hour,Activity / Remark\n'

    filteredEntries.forEach((entry: any) => {
      const date = new Date(entry.date).toLocaleDateString('en-GB')
      const start = entry.startTime || '-'
      const end = entry.endTime || '-'
      const duration = entry.duration
      const activity = `"${entry.activity.replace(/"/g, '""')}"` 
      
      csvContent += `${date},${start},${end},${duration},${activity}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `Timesheet_Report_${selectedMonth || 'All'}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Berhasil mengekspor CSV')
  }

  const formatMonthLabel = (ym: string) => {
    if (!ym) return 'Semua Data'
    const [y, m] = ym.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, 1)
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet</h2>
          <p className="text-slate-500">Kelola catatan jam kerja Anda di sini.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="month-filter" className="text-slate-500 whitespace-nowrap">Filter Bulan:</Label>
            <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val || '')}>
              <SelectTrigger className="w-[180px] bg-white hover:bg-slate-50 transition-colors">
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

          <Button variant="outline" onClick={handleExportCSV} className="gap-2 text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Export CSV
          </Button>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button className="gap-2 hover:bg-slate-800 transition-colors cursor-pointer">
                  <Plus className="w-4 h-4" /> Tambah Entry
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Tambah Catatan Waktu</DialogTitle>
                  <DialogDescription>
                    Masukkan detail aktivitas kerja Anda hari ini.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2 relative">
                    <Label htmlFor="date">Date</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <Input 
                        id="date" 
                        type="date" 
                        className="pl-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                        value={formData.date}
                        onChange={e => setFormData({...formData, date: e.target.value})}
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2 relative">
                      <Label htmlFor="startTime">Start Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <Input 
                          id="startTime" 
                          type="time" 
                          className="pl-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                          value={formData.startTime}
                          onChange={e => setFormData({...formData, startTime: e.target.value})}
                          required 
                        />
                      </div>
                    </div>
                    <div className="grid gap-2 relative">
                      <Label htmlFor="endTime">End Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <Input 
                          id="endTime" 
                          type="time" 
                          className="pl-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full"
                          value={formData.endTime}
                          onChange={e => setFormData({...formData, endTime: e.target.value})}
                          required 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Total Hour (Otomatis)</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      value={formData.duration}
                      readOnly
                      disabled
                      className="bg-slate-100 font-medium"
                      placeholder="Dihitung otomatis..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="activity">Activity / Remark</Label>
                    <Input 
                      id="activity" 
                      placeholder="Contoh: Coding Frontend, Fix Bugs" 
                      value={formData.activity}
                      onChange={e => setFormData({...formData, activity: e.target.value})}
                      required 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Simpan Entry</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200/50">
        <CardContent className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm text-slate-500">Tampilkan:</Label>
              <Select 
                value={String(pageSize)} 
                onValueChange={(val) => {
                  if (!val) return
                  setPageSize(val === 'All' ? 'All' : Number(val))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="All">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-slate-500">
              Total: {filteredEntries.length} data
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead rowSpan={2} className="w-[15%] font-semibold text-slate-700 text-center align-middle border-r">
                    Date
                  </TableHead>
                  <TableHead colSpan={3} className="w-[30%] font-semibold text-slate-700 text-center border-b border-r">
                    Working Hour
                  </TableHead>
                  <TableHead rowSpan={2} className="w-[15%] font-semibold text-slate-700 text-center align-middle border-r">
                    Total Hour
                  </TableHead>
                  <TableHead rowSpan={2} className="w-[30%] font-semibold text-slate-700 text-center align-middle border-r">
                    Activity / Remark
                  </TableHead>
                  <TableHead rowSpan={2} className="w-[10%] font-semibold text-slate-700 text-center align-middle">
                    Action
                  </TableHead>
                </TableRow>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[10%] font-semibold text-slate-700 text-center border-r">Start</TableHead>
                  <TableHead className="w-[10%] font-semibold text-slate-700 text-center border-r">-</TableHead>
                  <TableHead className="w-[10%] font-semibold text-slate-700 text-center border-r">End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Belum ada data timesheet untuk filter ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEntries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-center border-r">{new Date(entry.date).toLocaleDateString('en-GB')}</TableCell>
                      <TableCell className="text-center border-r">{entry.startTime || '-'}</TableCell>
                      <TableCell className="text-center border-r text-slate-400">-</TableCell>
                      <TableCell className="text-center border-r">{entry.endTime || '-'}</TableCell>
                      <TableCell className="text-center border-r font-medium">{entry.duration}</TableCell>
                      <TableCell className="text-center border-r">{entry.activity}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          {pageSize !== 'All' && totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-slate-50/50">
              <p className="text-sm text-slate-500">
                Halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
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
