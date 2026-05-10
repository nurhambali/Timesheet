const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const api = {
  async request(path: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }

    return response.json()
  },

  get(path: string) {
    return this.request(path, { method: 'GET' })
  },

  post(path: string, body: any) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  put(path: string, body: any) {
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  delete(path: string) {
    return this.request(path, { method: 'DELETE' })
  },

  async downloadBlob(path: string, body: any, filename: string = 'download.xlsx') {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ message: 'Download failed' }))
      throw new Error(errData.message || 'Download failed')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    
    return { success: true }
  },

  async uploadFile(path: string, file: File) {
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData
    })
    return response.json()
  }
}
