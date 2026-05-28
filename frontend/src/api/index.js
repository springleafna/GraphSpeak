const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

function normalizeIds(data) {
  if (!data) return data

  if (Array.isArray(data)) {
    return data.map(normalizeIds)
  }

  if (typeof data === 'object') {
    const result = {}
    for (const key in data) {
      result[key] = normalizeIds(data[key])
    }
    if (result.id !== undefined) {
      result.id = Number(result.id)
    }
    if (result.project_id !== undefined) {
      result.project_id = Number(result.project_id)
    }
    if (result.session_id !== undefined) {
      result.session_id = Number(result.session_id)
    }
    return result
  }

  return data
}

async function request(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, config)
    const data = await response.json()

    if (data.code !== 200) {
      throw new Error(data.message || '请求失败')
    }

    return normalizeIds(data.data)
  } catch (error) {
    console.error('API Error:', error)
    throw error
  }
}

export const projectApi = {
  list: () => request('/projects'),

  get: (id) => request(`/projects/${id}`),

  create: (data) => request('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => request(`/projects/${id}`, {
    method: 'DELETE',
  }),
}

export const sessionApi = {
  list: (projectId) => request(`/sessions?projectId=${projectId}`),

  create: (data) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  delete: (id) => request(`/sessions/${id}`, {
    method: 'DELETE',
  }),
}

export const messageApi = {
  list: (sessionId) => request(`/messages?sessionId=${sessionId}`),

  stream: async (sessionId, content, onMessage) => {
    try {
      const response = await fetch(`${BASE_URL}/messages/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, content }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              onMessage(data)
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream error:', error)
      throw error
    }
  },
}

export default {
  project: projectApi,
  session: sessionApi,
  message: messageApi,
}