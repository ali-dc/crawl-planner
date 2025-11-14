// Use relative URLs when served from the same origin, otherwise use configured API_URL
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiClient = {
  async get(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    return response.json()
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `API error: ${response.status}`)
    }

    return response.json()
  },

  // Plan a pub crawl route
  async planCrawl(startPoint, endPoint, numPubs, uniformityWeight = 0.2, includeDirections = true) {
    return this.post('/plan', {
      start_point: {
        longitude: startPoint[0],
        latitude: startPoint[1],
      },
      end_point: {
        longitude: endPoint[0],
        latitude: endPoint[1],
      },
      num_pubs: numPubs,
      uniformity_weight: uniformityWeight,
      include_directions: includeDirections,
    })
  },

  // Get directions for a route
  async getDirections(routeIndices) {
    return this.post('/directions', {
      route_indices: routeIndices,
    })
  },

  // Health check
  async health() {
    return this.get('/health')
  },

  // Get list of pubs
  async getPubs(skip = 0, limit = 100) {
    return this.get(`/pubs?skip=${skip}&limit=${limit}`)
  },

  // Get a specific pub
  async getPub(pubId) {
    return this.get(`/pubs/${pubId}`)
  },

  // Parse raw data
  async parse() {
    return this.post('/parse', {})
  },

  // Precompute distances
  async precompute() {
    return this.post('/precompute', {})
  },

  // Get precomputation status
  async getStatus() {
    return this.get('/status')
  },
}
