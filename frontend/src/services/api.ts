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
  pub_id: string
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
  pub_indices?: number[]
  route_indices?: (number | string)[]
  pubs: Pub[]
  total_distance_meters: number
  estimated_time_minutes: number
  num_pubs?: number
  legs?: RouteLeg[]
  directions?: {
    geometry: {
      coordinates: [number, number][]
    }
  }
  share_id?: string
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

export interface CreateSharedRouteRequest {
  start_point: Coordinate
  end_point: Coordinate
  route_indices: (number | string)[]
  selected_pub_ids: string[]
  num_pubs: number
  uniformity_weight: number
  total_distance_meters: number
  estimated_time_minutes: number
  legs?: RouteLeg[]
}

export interface SharedRoute {
  share_id: string
  share_url: string
  created_at: string
  expires_at: string
  start_point: Coordinate
  end_point: Coordinate
  route_indices: (number | string)[]
  selected_pub_ids: string[]
  num_pubs: number
  uniformity_weight: number
  total_distance_meters: number
  estimated_time_minutes: number
  legs?: RouteLeg[]
  pubs?: Pub[]
}

export interface RouteEstimate {
  total_distance_meters: number
  estimated_time_minutes: number
}

export interface AlternativePub {
  pub_id: string
  pub_name: string
  longitude: number
  latitude: number
  added_distance_meters: number
  reason: string
}

export interface AlternativePubsResponse {
  alternatives: AlternativePub[]
  route_without_pub: RouteEstimate
}

// Use relative URLs when served from the same origin, otherwise use configured API_URL
const API_URL = import.meta.env.VITE_API_URL || ''

export const apiClient = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
      },
    })
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
    return this.post<Route>('/api/plan', {
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
    return this.post<Route>('/api/directions', {
      route_indices: routeIndices,
    })
  },

  // Health check
  async health(): Promise<HealthStatus> {
    return this.get<HealthStatus>('/api/health')
  },

  // Get list of pubs
  async getPubs(skip: number = 0, limit: number = 100): Promise<Pub[]> {
    return this.get<Pub[]>(`/api/pubs?skip=${skip}&limit=${limit}`)
  },

  // Get a specific pub
  async getPub(pubId: string): Promise<Pub> {
    return this.get<Pub>(`/api/pubs/${pubId}`)
  },

  // Parse raw data
  async parse(): Promise<StatusResponse> {
    return this.post<StatusResponse>('/api/parse', {})
  },

  // Precompute distances
  async precompute(): Promise<StatusResponse> {
    return this.post<StatusResponse>('/api/precompute', {})
  },

  // Get precomputation status
  async getStatus(): Promise<StatusResponse> {
    return this.get<StatusResponse>('/api/status')
  },

  // Get a shared route by ID
  async getSharedRoute(shareId: string): Promise<SharedRoute> {
    return this.get<SharedRoute>(`/api/routes/${shareId}`)
  },

  // Save a route to get a shareable link
  async saveRoute(request: CreateSharedRouteRequest): Promise<SharedRoute> {
    return this.post<SharedRoute>('/api/routes', request)
  },

  // Get alternative pubs when removing one from the route
  async getAlternativePubs(
    startPoint: Coordinate,
    endPoint: Coordinate,
    currentRouteIndices: (number | string)[],
    removedPubIndex: number,
    excludedPubIds: string[] = []
  ): Promise<AlternativePubsResponse> {
    return this.post<AlternativePubsResponse>('/api/routes/alternatives', {
      start_point: startPoint,
      end_point: endPoint,
      current_route_indices: currentRouteIndices,
      removed_pub_index: removedPubIndex,
      excluded_pub_ids: excludedPubIds,
    })
  },

  // Replace a pub in an existing route
  async replacePubInRoute(
    startPoint: Coordinate,
    endPoint: Coordinate,
    currentRouteIndices: (number | string)[],
    removedPubIndex: number,
    replacementPubId: string | null,
    numPubs: number,
    uniformityWeight: number,
    includeDirections: boolean
  ): Promise<Route> {
    return this.post<Route>('/api/routes/replace', {
      start_point: startPoint,
      end_point: endPoint,
      current_route_indices: currentRouteIndices,
      removed_pub_index: removedPubIndex,
      replacement_pub_id: replacementPubId,
      num_pubs: numPubs,
      uniformity_weight: uniformityWeight,
      include_directions: includeDirections,
    })
  },
}
