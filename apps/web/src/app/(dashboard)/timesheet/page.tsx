'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Download, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

export default function TimesheetPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('global')

  useEffect(() => {
    fetchEntries()
    fetchClients()
  }, [])

  const fetchEntries = async () => {
    setLoading(true)
    const res = await api.get('/timesheet')
    if (res.success) {
      setEntries(res.data)
    }
    setLoading(false)
  }

  const fetchClients = async () => {
    const res = await api.get('/clients')
    if (res.success) {
      setClients(res.data)
    }
  }

  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const filteredEntries = entries
    .filter(entry => {
      const entryMonth = format(new Date(entry.date), 'yyyy-MM')
      const matchesMonth = entryMonth === selectedMonth
      const matchesSearch = entry.activity.toLowerCase().includes(search.toLowerCase())
      return matchesMonth && matchesSearch
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
    })

  const handleExport = () => {
    if (filteredEntries.length === 0) {
      toast.error('Tidak ada data untuk bulan ini')
      return
    }

    const headers = ['Date', 'Start', 'End', 'Activity']
    const csvData = filteredEntries.map(entry => [
      format(new Date(entry.date), 'dd/MM/yyyy'),
      entry.startTime || '-',
      entry.endTime || '-',
      entry.activity
    ])

    const csvContent = [headers, ...csvData].map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Timesheet_${selectedMonth}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Laporan berhasil diexport')
  }

  const handleExportClient = async () => {
    if (!selectedMonth) {
      toast.error('Pilih bulan terlebih dahulu')
      return
    }

    try {
      const blob = await api.downloadBlob('/timesheet/export-client', { 
        month: selectedMonth,
        clientId: selectedClientId === 'global' ? undefined : selectedClientId
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const clientName = selectedClientId === 'global' ? 'Global' : clients.find(c => c.id === selectedClientId)?.name || 'Client'
      a.download = `Timesheet_${clientName}_${selectedMonth}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast.success(`Laporan format ${clientName} berhasil diunduh`)
    } catch (error) {
      toast.error('Gagal mengunduh laporan. Pastikan template sudah diupload di Settings.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus entri ini?')) return
    const res = await api.delete(`/timesheet/${id}`)
    if (res.success) {
      toast.success('Entri dihapus')
      fetchEntries()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Timesheet Catatan</h2>
          <p className="text-slate-500">Daftar riwayat aktivitas kerja Anda.</p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200/50">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari aktivitas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-48">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Pilih Format Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Format Global (Master)</SelectItem>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        Format {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="gap-2 border-green-600 text-green-600 hover:bg-green-50" onClick={handleExportClient}>
                <Download className="w-4 h-4" /> Export Client
              </Button>

              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[120px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={toggleSort}>
                    <div className="flex items-center gap-1">
                      Tanggal
                      {sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                  </TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead className="text-right">Durasi</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data untuk periode ini.</TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>{entry.startTime || '-'}</TableCell>
                      <TableCell>{entry.endTime || '-'}</TableCell>
                      <TableCell className="max-w-md truncate">{entry.activity}</TableCell>
                      <TableCell className="text-right">{entry.duration}h</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
