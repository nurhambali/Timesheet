'use client'

import React, { useEffect, useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Clock, Calendar as CalendarIcon, Info, Settings, Trash2, Download, Upload, Eye, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Papa from 'papaparse'

const INDO_HOLIDAYS_2026 = [] // Will be fetched from API now

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [holidays, setHolidays] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const [manageHolidaysOpen, setManageHolidaysOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [newHoliday, setNewHoliday] = useState({ title: '', date: '', color: '#ef4444' })
  const [formData, setFormData] = useState({
    date: '',
    startTime: '08:00',
    endTime: '17:00',
    duration: '9.0',
    activity: '',
    note: '',
  })

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) setCurrentUser(JSON.parse(userData))
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    const [timesheetRes, holidayRes] = await Promise.all([
      api.get('/timesheet'),
      api.get('/holiday')
    ])

    let holidayEvents = []
    if (holidayRes.success) {
      setHolidays(holidayRes.data)
      holidayEvents = holidayRes.data.map((h: any) => ({
        title: h.title,
        date: h.date.split('T')[0],
        color: h.color,
        display: 'background',
        allDay: true
      }))
    }

    if (timesheetRes.success) {
      const timesheetEvents = timesheetRes.data.map((item: any) => ({
        id: item.id,
        title: `${item.user?.name || ''}: ${item.activity}`.trim(),
        start: `${item.date.split('T')[0]}T${item.startTime || '00:00'}:00`,
        end: `${item.date.split('T')[0]}T${item.endTime || '23:59'}:00`,
        extendedProps: item,
        backgroundColor: item.userId === currentUser?.id ? '#3b82f6' : '#10b981',
        borderColor: 'transparent'
      }))
      
      setEvents([...holidayEvents, ...timesheetEvents])
    }
  }

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await api.post('/holiday', newHoliday)
    if (res.success) {
      toast.success('Hari libur ditambahkan')
      setNewHoliday({ title: '', date: '', color: '#ef4444' })
      fetchEvents()
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    const res = await api.delete(`/holiday/${id}`)
    if (res.success) {
      toast.success('Hari libur dihapus')
      fetchEvents()
    }
  }

  const downloadTemplate = () => {
    const csvContent = "title,date,color\nTahun Baru 2026,2026-01-01,#ef4444\nContoh Libur,2026-12-31,#ef4444"
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template_holiday.csv")
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const validData = (results.data as any[]).filter((row: any) => row.title && row.date)
        if (validData.length === 0) {
          toast.error("Format CSV tidak valid atau kosong")
          return
        }

        let successCount = 0
        for (const row of validData) {
          const res = await api.post('/holiday', {
            title: row.title,
            date: row.date,
            color: row.color || '#ef4444'
          })
          if (res.success) successCount++
        }

        toast.success(`${successCount} hari libur berhasil diimport`)
        fetchEvents()
        e.target.value = ''
      }
    })
  }

  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps
    // If it's a holiday background event, don't open details unless it has a title
    if (props.id || props.activity || info.event.title) {
      setSelectedEvent({
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        ...props
      })
      setDetailsOpen(true)
    }
  }

  const handleDeleteEntry = async () => {
    if (!selectedEvent?.id) return
    const res = await api.delete(`/timesheet/${selectedEvent.id}`)
    if (res.success) {
      toast.success('Catatan dihapus')
      setDetailsOpen(false)
      fetchEvents()
    }
  }

  const handleEditEntryFromCalendar = () => {
    // Open the same edit logic from timesheet if needed, 
    // or we can just redirect to the edit state in this page
    setDetailsOpen(false)
    setFormData({
      date: selectedEvent.date.split('T')[0],
      startTime: selectedEvent.startTime || '',
      endTime: selectedEvent.endTime || '',
      duration: String(selectedEvent.duration),
      activity: selectedEvent.activity,
      note: selectedEvent.note || ''
    })
    // For simplicity, we can reuse the "open" dialog but for Edit
    // Let's add a separate edit mode or just reuse the post with ID
    // I'll update the handleSubmit to handle PUT if an ID exists
    setOpen(true)
  }

  const handleDateClick = (arg: any) => {
    setFormData({
      ...formData,
      date: arg.dateStr,
      activity: '',
      note: ''
    })
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // If we have an ID, it's an edit
    const isEdit = !!selectedEvent?.id && open
    const method = isEdit ? 'put' : 'post'
    const url = isEdit ? `/timesheet/${selectedEvent.id}` : '/timesheet'

    const response = await api[method](url, {
      ...formData,
      duration: parseFloat(formData.duration),
    })

    if (response.success) {
      toast.success(isEdit ? 'Berhasil diperbarui' : 'Berhasil menyimpan')
      setOpen(false)
      setSelectedEvent(null)
      fetchEvents()
    } else {
      toast.error('Gagal menyimpan data')
    }
  }

  // Auto calculate duration
  useEffect(() => {
    if (formData.startTime && formData.endTime) {
      const [startH, startM] = formData.startTime.split(':').map(Number)
      const [endH, endM] = formData.endTime.split(':').map(Number)
      let diffHours = (endH + endM / 60) - (startH + startM / 60)
      if (diffHours < 0) diffHours += 24 
      setFormData(prev => ({ ...prev, duration: diffHours.toFixed(1) }))
    }
  }, [formData.startTime, formData.endTime])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Calendar Schedule</h2>
          <p className="text-slate-500">Pantau jadwal dan input kegiatan langsung dari kalender.</p>
        </div>
        <div className="flex items-center gap-3">
          {currentUser?.role === 'ADMIN' && (
            <Button 
              variant="outline" 
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setManageHolidaysOpen(true)}
            >
              <Settings className="w-4 h-4" />
              Kelola Hari Libur
            </Button>
          )}
          <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-100">
            <Info className="w-4 h-4" />
            <span>Klik pada tanggal untuk menambah entry baru</span>
          </div>
        </div>
      </div>

      <Card className="shadow-xl border-slate-200 overflow-hidden">
        <CardContent className="p-4 bg-white">
          <div className="calendar-container">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={events}
              dateClick={handleDateClick}
              height="80vh"
              locale="id"
              buttonText={{
                today: 'Hari Ini',
                month: 'Bulan',
                week: 'Minggu',
                day: 'Hari'
              }}
              dayCellContent={(arg) => {
                const isWeekend = arg.date.getDay() === 0 || arg.date.getDay() === 6
                return (
                  <div className="flex flex-col h-full">
                    <span className="fc-daygrid-day-number">{arg.dayNumberText}</span>
                    {isWeekend && (
                      <span className="text-[10px] font-bold text-red-400 text-center mt-auto pb-1">
                        WEEKEND
                      </span>
                    )}
                  </div>
                )
              }}
              dayCellClassNames={(arg: any) => {
                const isWeekend = arg.date.getDay() === 0 || arg.date.getDay() === 6
                return isWeekend ? ['bg-slate-50/50'] : []
              }}
              eventClick={handleEventClick}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Details Popup */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Detail Informasi
            </DialogTitle>
            <DialogDescription>
              Informasi lengkap kegiatan pada tanggal terpilih.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {selectedEvent.activity ? 'Kegiatan / Timesheet' : 'Hari Libur / Kejadian'}
                </p>
                <h3 className="text-lg font-bold text-slate-900">{selectedEvent.title}</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> Tanggal
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(selectedEvent.start).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                  </p>
                </div>
                {selectedEvent.duration && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Durasi
                    </p>
                    <p className="text-sm font-medium">{selectedEvent.duration} Jam</p>
                  </div>
                )}
              </div>

              {(selectedEvent.startTime || selectedEvent.endTime) && (
                <div className="flex gap-4 p-3 bg-blue-50/50 rounded-md border border-blue-100/50">
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Mulai</p>
                    <p className="text-sm font-mono font-bold">{selectedEvent.startTime || '--:--'}</p>
                  </div>
                  <div className="w-[1px] bg-blue-200"></div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Selesai</p>
                    <p className="text-sm font-mono font-bold">{selectedEvent.endTime || '--:--'}</p>
                  </div>
                </div>
              )}

              {selectedEvent.note && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Catatan Tambahan:</p>
                  <div className="p-3 bg-amber-50/50 border border-amber-100 rounded text-sm text-slate-700 italic">
                    "{selectedEvent.note}"
                  </div>
                </div>
              )}

              {selectedEvent.user && (
                <div className="pt-2 border-t flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                    {selectedEvent.user.name.charAt(0)}
                  </div>
                  <p className="text-xs text-slate-500">Input oleh: <span className="font-semibold text-slate-900">{selectedEvent.user.name}</span></p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-between">
            <div className="flex gap-2">
              {(selectedEvent?.userId === currentUser?.id || currentUser?.role === 'ADMIN') && selectedEvent?.id && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={handleEditEntryFromCalendar}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleDeleteEntry}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setDetailsOpen(false)} variant="secondary" size="sm">Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Holidays Dialog (ADMIN ONLY) */}
      <Dialog open={manageHolidaysOpen} onOpenChange={setManageHolidaysOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Kelola Hari Libur & Kejadian</DialogTitle>
            <DialogDescription>
              Tambah atau hapus hari libur nasional yang akan tampil di kalender semua user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <form onSubmit={handleAddHoliday} className="grid gap-4 p-4 border rounded-lg bg-slate-50">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="h-title">Nama Libur</Label>
                  <Input 
                    id="h-title" 
                    placeholder="Contoh: Libur Pilkada" 
                    value={newHoliday.title}
                    onChange={e => setNewHoliday({...newHoliday, title: e.target.value})}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="h-date">Tanggal</Label>
                  <Input 
                    id="h-date" 
                    type="date" 
                    value={newHoliday.date}
                    onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">Tambah Hari Libur</Button>
            </form>

            <div className="flex items-center justify-between px-1">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi Cepat</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={downloadTemplate}>
                  <Download className="w-3 h-3" /> Template
                </Button>
                <div className="relative">
                  <Input 
                    type="file" 
                    accept=".csv" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-[80px]" 
                    onChange={handleImportCSV}
                  />
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 pointer-events-none">
                    <Upload className="w-3 h-3" /> Import CSV
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Hari Libur Terdaftar</Label>
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{h.title}</p>
                    <p className="text-xs text-slate-500">{new Date(h.date).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteHoliday(h.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Input Dialog via Calendar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Input via Calendar
            </DialogTitle>
            <DialogDescription>
              Menambah entry untuk tanggal: <span className="font-bold text-slate-900">{formData.date}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cal-startTime">Start Time</Label>
                  <Input 
                    id="cal-startTime" 
                    type="time" 
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cal-endTime">End Time</Label>
                  <Input 
                    id="cal-endTime" 
                    type="time" 
                    value={formData.endTime}
                    onChange={e => setFormData({...formData, endTime: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cal-duration">Total Hour (Otomatis)</Label>
                <Input 
                  id="cal-duration" 
                  value={formData.duration}
                  readOnly
                  disabled
                  className="bg-slate-100"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cal-activity">Activity / Remark</Label>
                <Textarea 
                  id="cal-activity" 
                  placeholder="Apa yang Anda kerjakan hari ini?" 
                  className="min-h-[100px] resize-none"
                  value={formData.activity}
                  onChange={e => setFormData({...formData, activity: e.target.value})}
                  required 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Simpan Catatan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .fc {
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #e2e8f0;
          --fc-button-text-color: #1e293b;
          --fc-button-hover-bg-color: #f1f5f9;
          --fc-button-hover-border-color: #cbd5e1;
          --fc-button-active-bg-color: #2563eb;
          --fc-button-active-border-color: #2563eb;
          --fc-event-bg-color: #3b82f6;
          --fc-event-border-color: transparent;
          font-family: inherit;
        }
        .fc .fc-toolbar-title {
          font-size: 1.5rem !important;
          font-weight: 800 !important;
          color: #0f172a;
          letter-spacing: -0.025em;
        }
        .fc .fc-button-primary:not(:disabled).fc-button-active, 
        .fc .fc-button-primary:not(:disabled):active {
          background-color: #2563eb !important;
          color: white !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .fc-theme-standard td, .fc-theme-standard th {
          border: 1px solid #e2e8f0 !important;
        }
        .fc-col-header-cell {
          background-color: #f8fafc;
          padding: 16px 0 !important;
          font-weight: 700 !important;
          color: #334155 !important;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .fc-daygrid-day-number {
          font-weight: 600;
          padding: 12px !important;
          color: #64748b;
          width: 100%;
          text-align: right;
          font-size: 0.875rem;
        }
        .fc-daygrid-day-frame {
          min-height: 120px !important;
          transition: background-color 0.2s;
        }
        .fc-daygrid-day:hover {
          background-color: #f8fafc;
        }
        .bg-slate-50\/50 {
          background-color: #f1f5f9 !important;
        }
        .fc-event {
          cursor: pointer;
          padding: 4px 8px !important;
          border-radius: 6px !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          border: none !important;
          margin: 2px 4px !important;
          transition: transform 0.1s, filter 0.1s;
        }
        .fc-event:hover {
          transform: translateY(-1px);
          filter: brightness(0.95);
        }
        .fc-day-today {
          background-color: #eff6ff !important;
        }
        .fc-day-today .fc-daygrid-day-number {
          color: #2563eb;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}
