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
        // Only redirect if not already on login page
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

  patch(path: string, body: any) {
    return this.request(path, {
      method: 'PATCH',
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

  async downloadBlob(path: string, body: any) {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error('Download failed')
    return response.blob()
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
