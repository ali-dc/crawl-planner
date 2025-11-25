// API Types
export interface Coordinate {
  longitude: number
  latitude: number
}

export interface StartEndPoint {
  longitude: number
  latitude: number
}

export interface PlanRequest {
  start_point: StartEndPoint
  end_point: StartEndPoint
  num_pubs: number
  uniformity_weight: number
  include_directions: boolean
}

export interface Pub {
  id: string
  pub_name: string
  address: string
  longitude: number
  latitude: number
}

export interface RouteLeg {
  distance_meters: number
  duration_seconds: number
  geometry?: {
    coordinates: [number, number][]
  }
  geometry_encoded?: string
}

export interface Route {
  pub_indices: number[]
  pubs: Pub[]
  total_distance_meters: number
  estimated_time_minutes: number
  legs: RouteLeg[]
  directions?: {
    geometry: {
      coordinates: [number, number][]
    }
  }
}

export interface DirectionsRequest {
  route_indices: number[]
}

export interface HealthStatus {
  status: string
  osrm_available: boolean
}

export interface StatusResponse {
  status: string
  progress?: number
}

// Use relative URLs when served from the same origin, otherwise use configured API_URL
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    return response.json()
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = (await response.json()) as { detail?: string }
      throw new Error(error.detail || `API error: ${response.status}`)
    }

    return response.json()
  },

  // Plan a pub crawl route
  async planCrawl(
    startPoint: [number, number],
    endPoint: [number, number],
    numPubs: number,
    uniformityWeight: number = 0.2,
    includeDirections: boolean = true
  ): Promise<Route> {
    return this.post<Route>('/plan', {
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
  async getDirections(routeIndices: number[]): Promise<Route> {
    return this.post<Route>('/directions', {
      route_indices: routeIndices,
    })
  },

  // Health check
  async health(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/health')
  },

  // Get list of pubs
  async getPubs(skip: number = 0, limit: number = 100): Promise<Pub[]> {
    return this.get<Pub[]>(`/pubs?skip=${skip}&limit=${limit}`)
  },

  // Get a specific pub
  async getPub(pubId: string): Promise<Pub> {
    return this.get<Pub>(`/pubs/${pubId}`)
  },

  // Parse raw data
  async parse(): Promise<StatusResponse> {
    return this.post<StatusResponse>('/parse', {})
  },

  // Precompute distances
  async precompute(): Promise<StatusResponse> {
    return this.post<StatusResponse>('/precompute', {})
  },

  // Get precomputation status
  async getStatus(): Promise<StatusResponse> {
    return this.get<StatusResponse>('/status')
  },
}
