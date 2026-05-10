'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Clock, CalendarIcon, Download, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Papa from 'papaparse'

export default function TimesheetPage() {
  const [allEntries, setAllEntries] = useState([])
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    duration: '',
    activity: '',
    note: '',
  })

  const [editFormData, setEditFormData] = useState({
    date: '',
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
    const userData = localStorage.getItem('user')
    if (userData) setCurrentUser(JSON.parse(userData))
  }, [])

  // Auto calculation for Add Form
  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const [startH, startM] = formData.startTime.split(':').map(Number)
      const [endH, endM] = formData.endTime.split(':').map(Number)
      let diffHours = (endH + endM / 60) - (startH + startM / 60)
      if (diffHours < 0) diffHours += 24 
      setFormData(prev => ({ ...prev, duration: diffHours.toFixed(1) }))
    }
  }, [formData.startTime, formData.endTime])

  // Auto calculation for Edit Form
  useEffect(() => {
    if (editFormData.startTime && editFormData.endTime) {
      const [startH, startM] = editFormData.startTime.split(':').map(Number)
      const [endH, endM] = editFormData.endTime.split(':').map(Number)
      let diffHours = (endH + endM / 60) - (startH + startM / 60)
      if (diffHours < 0) diffHours += 24 
      setEditFormData(prev => ({ ...prev, duration: diffHours.toFixed(1) }))
    }
  }, [editFormData.startTime, editFormData.endTime])

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
    } else {
      toast.error('Gagal menyimpan data')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await api.put(`/timesheet/${selectedEntry.id}`, {
      ...editFormData,
      duration: parseFloat(editFormData.duration),
    })

    if (response.success) {
      toast.success('Berhasil memperbarui catatan waktu')
      setEditOpen(false)
      fetchEntries()
    } else {
      toast.error('Gagal memperbarui data')
    }
  }

  const openEditDialog = (entry: any) => {
    setSelectedEntry(entry)
    setEditFormData({
      date: entry.date.split('T')[0],
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
      duration: String(entry.duration),
      activity: entry.activity,
      note: entry.note || '',
    })
    setEditOpen(true)
  }

  const handleExport = async () => {
    if (!selectedMonth) {
      toast.error('Pilih bulan terlebih dahulu')
      return
    }

    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const holRes = await api.get('/holiday')
    const holidays = holRes.success ? holRes.data : []
    const isAdmin = currentUser?.role === 'ADMIN'
    
    const exportData = []
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day)
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayEntries = allEntries.filter((e: any) => e.date.split('T')[0] === dateStr)
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
      const holiday = holidays.find((h: any) => h.date.split('T')[0] === dateStr)
      
      // Row penanda Libur/Weekend (Durasi 24 jam)
      if (holiday || isWeekend) {
        const holidayRow: any = {
          Tanggal: dateStr,
          'Hari': currentDate.toLocaleDateString('id-ID', { weekday: 'long' }),
          'Start Time': '',
          'End Time': '',
          'Total Jam': 24,
          'Aktivitas': holiday ? holiday.title : 'WEEKEND',
        }
        if (isAdmin) holidayRow['User'] = ''
        exportData.push(holidayRow)
      }

      // Baris Aktivitas User (Jika ada)
      if (dayEntries.length > 0) {
        dayEntries.forEach((entry: any) => {
          const row: any = {
            Tanggal: dateStr,
            'Hari': currentDate.toLocaleDateString('id-ID', { weekday: 'long' }),
            'Start Time': entry.startTime || '',
            'End Time': entry.endTime || '',
            'Total Jam': entry.duration,
            'Aktivitas': entry.activity,
          }
          if (isAdmin) row['User'] = entry.user?.name || ''
          exportData.push(row)
        })
      } else if (!holiday && !isWeekend) {
        // Hari kerja biasa tapi kosong
        const emptyRow: any = {
          Tanggal: dateStr,
          'Hari': currentDate.toLocaleDateString('id-ID', { weekday: 'long' }),
          'Start Time': '',
          'End Time': '',
          'Total Jam': 0,
          'Aktivitas': '',
        }
        if (isAdmin) emptyRow['User'] = ''
        exportData.push(emptyRow)
      }
    }

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `Timesheet_Report_${selectedMonth}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Laporan berhasil diexport')
  }

  const handleDelete = async () => {
    if (!entryToDelete) return
    const response = await api.delete(`/timesheet/${entryToDelete}`)
    if (response.success) {
      toast.success('Catatan berhasil dihapus')
      fetchEntries()
    }
    setDeleteOpen(false)
    setEntryToDelete(null)
  }

  const confirmDelete = (id: string) => {
    setEntryToDelete(id)
    setDeleteOpen(true)
  }

  const handleBulkDelete = async () => {
    const response = await api.post('/timesheet/bulk-delete', { ids: selectedIds })
    if (response.success) {
      toast.success(`${selectedIds.length} catatan berhasil dihapus`)
      setSelectedIds([])
      fetchEntries()
    }
    setBulkDeleteOpen(false)
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filteredEntries.map((e: any) => e.id))
    else setSelectedIds([])
  }

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) setSelectedIds(prev => [...prev, id])
    else setSelectedIds(prev => prev.filter(i => i !== id))
  }

  const filteredEntries = allEntries.filter((e: any) => {
    if (!selectedMonth) return true
    const d = new Date(e.date)
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return yearMonth === selectedMonth
  })

  const sortedEntries = [...filteredEntries].sort((a: any, b: any) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
  })

  const paginatedEntries = pageSize === 'All' 
    ? sortedEntries 
    : sortedEntries.slice((currentPage - 1) * (pageSize as number), currentPage * (pageSize as number))

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredEntries.length / (pageSize as number))

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet Catatan</h2>
          <p className="text-slate-500">Kelola catatan waktu kerja harian Anda.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="month" className="text-sm font-medium">Bulan:</Label>
            <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v || '')}>
              <SelectTrigger id="month" className="w-[180px] h-10 bg-white">
                <SelectValue placeholder="Pilih Bulan" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>
                    {new Date(m + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Tambah Entry
                </Button>
              } />
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Tambah Catatan Waktu</DialogTitle>
                  <DialogDescription>Masukkan detail pekerjaan Anda di bawah ini.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="date">Tanggal</Label>
                      <Input id="date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input id="startTime" type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="endTime">End Time</Label>
                        <Input id="endTime" type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} required />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="activity">Activity / Remark</Label>
                      <Textarea id="activity" className="min-h-[100px]" value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})} required />
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
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
            <div className="flex items-center gap-4">
              <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(val === 'All' ? 'All' : Number(val)); setCurrentPage(1); }}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-white">
                  <SelectValue placeholder="30" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="60">60</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="All">Semua</SelectItem>
                </SelectContent>
              </Select>
              {selectedIds.length > 0 && (
                <Button variant="destructive" size="sm" className="h-8" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Hapus Terpilih ({selectedIds.length})
                </Button>
              )}
            </div>
            <div className="text-sm text-slate-500">Total: {filteredEntries.length} data</div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center border-r"><Checkbox checked={selectedIds.length === paginatedEntries.length && paginatedEntries.length > 0} onCheckedChange={(c) => toggleSelectAll(!!c)} /></TableHead>
                  <TableHead 
                    className="text-center border-r cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={toggleSort}
                  >
                    <div className="flex items-center justify-center gap-2">
                      Date
                      {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </TableHead>
                  <TableHead className="text-center border-r">Start</TableHead>
                  <TableHead className="text-center border-r">End</TableHead>
                  <TableHead className="text-center border-r">Hours</TableHead>
                  <TableHead className="text-center border-r">Activity</TableHead>
                  {currentUser?.role === 'ADMIN' && <TableHead className="text-center border-r">User</TableHead>}
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-center border-r"><Checkbox checked={selectedIds.includes(entry.id)} onCheckedChange={(c) => toggleSelect(entry.id, !!c)} /></TableCell>
                    <TableCell className="text-center border-r">{new Date(entry.date).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell className="text-center border-r">{entry.startTime}</TableCell>
                    <TableCell className="text-center border-r">{entry.endTime}</TableCell>
                    <TableCell className="text-center border-r font-medium">{entry.duration}</TableCell>
                    <TableCell className="text-center border-r">{entry.activity}</TableCell>
                    {currentUser?.role === 'ADMIN' && <TableCell className="text-center border-r text-blue-600">{entry.user?.name}</TableCell>}
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(entry)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => confirmDelete(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit Catatan Waktu</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="e-date">Tanggal</Label>
                <Input id="e-date" type="date" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="e-start">Start Time</Label>
                  <Input id="e-start" type="time" value={editFormData.startTime} onChange={e => setEditFormData({...editFormData, startTime: e.target.value})} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="e-end">End Time</Label>
                  <Input id="e-end" type="time" value={editFormData.endTime} onChange={e => setEditFormData({...editFormData, endTime: e.target.value})} required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="e-act">Activity</Label>
                <Textarea id="e-act" className="min-h-[100px]" value={editFormData.activity} onChange={e => setEditFormData({...editFormData, activity: e.target.value})} required />
              </div>
            </div>
            <DialogFooter><Button type="submit">Simpan Perubahan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Catatan?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus {selectedIds.length} Catatan?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600">Hapus Semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
