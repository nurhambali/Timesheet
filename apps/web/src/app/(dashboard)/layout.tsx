'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) return null

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
