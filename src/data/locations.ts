import type { Place } from '../types'

export const GLOBE_PLACE: Place = {
  id: 'global',
  name: 'Global',
  region: 'Earth',
  kind: 'global',
  lat: 15,
  lon: 20,
  bbox: [-180, -85, 180, 85],
  level: 1,
  footprintKm: 40000,
  blurb: 'Whole-planet view. Best for planetary-scale patterns and seasonal shifts.',
}

export const PLACES: Place[] = [
  GLOBE_PLACE,
  // Continents
  { id: 'asia', name: 'Asia', kind: 'continent', lat: 34, lon: 90, bbox: [26, -11, 150, 82], level: 2, footprintKm: 8500, blurb: 'Monsoon systems, Himalayan ice and dense population centres.' },
  { id: 'africa', name: 'Africa', kind: 'continent', lat: 2, lon: 20, bbox: [-18, -35, 52, 38], level: 2, footprintKm: 8000, blurb: 'Sahel rainfall, savanna phenology and Saharan dust.' },
  { id: 'europe', name: 'Europe', kind: 'continent', lat: 51, lon: 12, bbox: [-25, 34, 45, 72], level: 2, footprintKm: 5000, blurb: 'Heatwaves, Atlantic storm tracks and alpine snow cover.' },
  { id: 'north-america', name: 'North America', kind: 'continent', lat: 45, lon: -100, bbox: [-170, 7, -52, 75], level: 2, footprintKm: 8000, blurb: 'Wildfire smoke, drought and continental temperature swings.' },
  { id: 'south-america', name: 'South America', kind: 'continent', lat: -15, lon: -60, bbox: [-82, -56, -34, 13], level: 2, footprintKm: 6000, blurb: 'Amazon moisture recycling and Andean glacier retreat.' },
  { id: 'oceania', name: 'Oceania', kind: 'continent', lat: -25, lon: 140, bbox: [110, -48, 180, 0], level: 2, footprintKm: 6000, blurb: 'ENSO-driven rainfall variability and coral bleaching heat stress.' },
  { id: 'antarctica', name: 'Antarctica', kind: 'continent', lat: -80, lon: 0, bbox: [-180, -90, 180, -60], level: 2, footprintKm: 6000, blurb: 'Polar imagery is seasonal; some products have no retrievals in polar night.' },

  // Countries
  { id: 'india', name: 'India', kind: 'country', lat: 22.5, lon: 80, bbox: [68, 6, 98, 36], level: 3, footprintKm: 3000, blurb: 'South Asian monsoon, heat extremes and rapid land-cover change.' },
  { id: 'china', name: 'China', kind: 'country', lat: 35, lon: 104, bbox: [73, 18, 135, 54], level: 3, footprintKm: 4000 },
  { id: 'usa', name: 'United States', kind: 'country', lat: 38, lon: -97, bbox: [-125, 24, -66, 50], level: 3, footprintKm: 4000 },
  { id: 'brazil', name: 'Brazil', kind: 'country', lat: -10, lon: -52, bbox: [-74, -34, -34, 6], level: 3, footprintKm: 4000 },
  { id: 'kenya', name: 'Kenya', kind: 'country', lat: 0, lon: 37.5, bbox: [33, -5, 42, 5], level: 3, footprintKm: 1000, blurb: 'Equatorial drought and flood cycles; a test case for rainfall variability.' },
  { id: 'indonesia', name: 'Indonesia', kind: 'country', lat: -2, lon: 118, bbox: [95, -11, 141, 6], level: 3, footprintKm: 3000 },
  { id: 'australia', name: 'Australia', kind: 'country', lat: -25, lon: 134, bbox: [112, -44, 154, -10], level: 3, footprintKm: 4000, blurb: 'Heat, bushfire smoke and episodic flooding.' },
  { id: 'norway', name: 'Norway', kind: 'country', lat: 62, lon: 10, bbox: [4, 57, 32, 72], level: 3, footprintKm: 1500 },
  { id: 'egypt', name: 'Egypt', kind: 'country', lat: 27, lon: 30, bbox: [24, 22, 36, 32], level: 3, footprintKm: 1200 },
  { id: 'japan', name: 'Japan', kind: 'country', lat: 37, lon: 138, bbox: [129, 30, 146, 46], level: 3, footprintKm: 1500 },
  { id: 'uk', name: 'United Kingdom', kind: 'country', lat: 54, lon: -2, bbox: [-8, 49, 2, 61], level: 3, footprintKm: 1000 },
  { id: 'bangladesh', name: 'Bangladesh', kind: 'country', lat: 23.7, lon: 90.3, bbox: [88, 20, 93, 27], level: 3, footprintKm: 600, blurb: 'Delta flooding, cyclones and very high population exposure.' },
  { id: 'sri-lanka', name: 'Sri Lanka', kind: 'country', lat: 7.6, lon: 80.7, bbox: [79, 5, 82, 10], level: 3, footprintKm: 500 },

  // Indian states
  { id: 'kerala', name: 'Kerala', region: 'India', kind: 'state', lat: 10.5, lon: 76.4, bbox: [74.8, 8.1, 77.6, 12.9], level: 4, footprintKm: 180, blurb: 'A narrow coastal state on the Western Ghats: extreme monsoon rainfall and high humidity.' },
  { id: 'tamil-nadu', name: 'Tamil Nadu', region: 'India', kind: 'state', lat: 11.1, lon: 78.7, bbox: [76, 8, 80.5, 13.6], level: 4, footprintKm: 700 },
  { id: 'karnataka', name: 'Karnataka', region: 'India', kind: 'state', lat: 15, lon: 76.3, bbox: [74, 11.5, 78.6, 18.5], level: 4, footprintKm: 800 },
  { id: 'maharashtra', name: 'Maharashtra', region: 'India', kind: 'state', lat: 19.5, lon: 76, bbox: [72.6, 15.6, 80.9, 22.1], level: 4, footprintKm: 900 },
  { id: 'gujarat', name: 'Gujarat', region: 'India', kind: 'state', lat: 22.3, lon: 71.5, bbox: [68, 20, 74.5, 24.7], level: 4, footprintKm: 800 },
  { id: 'rajasthan', name: 'Rajasthan', region: 'India', kind: 'state', lat: 26.6, lon: 74, bbox: [69.5, 23, 78.3, 30.2], level: 4, footprintKm: 900 },
  { id: 'west-bengal', name: 'West Bengal', region: 'India', kind: 'state', lat: 23.5, lon: 87.8, bbox: [85.8, 21.5, 89.9, 27.2], level: 4, footprintKm: 700 },
  { id: 'delhi', name: 'Delhi', region: 'India', kind: 'state', lat: 28.65, lon: 77.2, bbox: [76.8, 28.4, 77.4, 28.9], level: 4, footprintKm: 60, blurb: 'Winter aerosol loading is one of the most visible atmospheric signals in this app.' },
  { id: 'uttarakhand', name: 'Uttarakhand', region: 'India', kind: 'state', lat: 30.1, lon: 79.2, bbox: [77.5, 28.7, 81.1, 31.5], level: 4, footprintKm: 400 },
  { id: 'odisha', name: 'Odisha', region: 'India', kind: 'state', lat: 20.2, lon: 84.5, bbox: [81.3, 17.8, 87.5, 22.6], level: 4, footprintKm: 700 },
  { id: 'assam', name: 'Assam', region: 'India', kind: 'state', lat: 26.2, lon: 92.9, bbox: [89.7, 24, 96, 28], level: 4, footprintKm: 700 },

  // Kerala districts & towns
  { id: 'chengannur', name: 'Chengannur', region: 'Alappuzha, Kerala', kind: 'town', lat: 9.32, lon: 76.62, bbox: [76.53, 9.24, 76.7, 9.4], level: 4, footprintKm: 8, blurb: 'A small town on the Pamba river. NASA’s 1° and 50 km products see one regional cell here — this app says so explicitly.' },
  { id: 'alappuzha', name: 'Alappuzha', region: 'Kerala', kind: 'district', lat: 9.35, lon: 76.4, bbox: [76.1, 9.1, 76.7, 9.6], level: 4, footprintKm: 40 },
  { id: 'kottayam', name: 'Kottayam', region: 'Kerala', kind: 'district', lat: 9.6, lon: 76.65, bbox: [76.3, 9.3, 77, 9.9], level: 4, footprintKm: 45 },
  { id: 'pathanamthitta', name: 'Pathanamthitta', region: 'Kerala', kind: 'district', lat: 9.25, lon: 76.8, bbox: [76.4, 8.9, 77.2, 9.6], level: 4, footprintKm: 50 },
  { id: 'idukki', name: 'Idukki', region: 'Kerala', kind: 'district', lat: 9.8, lon: 76.9, bbox: [76.6, 9.4, 77.4, 10.3], level: 4, footprintKm: 70, blurb: 'High Western Ghats terrain: satellite rainfall and 1° products struggle with the steep gradient here.' },
  { id: 'ernakulam', name: 'Ernakulam', region: 'Kerala', kind: 'district', lat: 10, lon: 76.4, bbox: [76.1, 9.7, 76.8, 10.3], level: 4, footprintKm: 45 },
  { id: 'thrissur', name: 'Thrissur', region: 'Kerala', kind: 'district', lat: 10.5, lon: 76.3, bbox: [75.9, 10.1, 76.9, 10.8], level: 4, footprintKm: 50 },
  { id: 'palakkad', name: 'Palakkad', region: 'Kerala', kind: 'district', lat: 10.8, lon: 76.6, bbox: [76.2, 10.3, 77, 11.2], level: 4, footprintKm: 60 },
  { id: 'malappuram', name: 'Malappuram', region: 'Kerala', kind: 'district', lat: 11.05, lon: 76.1, bbox: [75.7, 10.6, 76.6, 11.4], level: 4, footprintKm: 55 },
  { id: 'kozhikode', name: 'Kozhikode', region: 'Kerala', kind: 'district', lat: 11.4, lon: 75.9, bbox: [75.5, 11, 76.3, 11.7], level: 4, footprintKm: 45 },
  { id: 'wayanad', name: 'Wayanad', region: 'Kerala', kind: 'district', lat: 11.7, lon: 76, bbox: [75.6, 11.3, 76.4, 12], level: 4, footprintKm: 55, blurb: 'Landslide-prone plateau; 1 km land-surface products are more informative than 1° air-temperature products here.' },
  { id: 'kannur', name: 'Kannur', region: 'Kerala', kind: 'district', lat: 11.9, lon: 75.6, bbox: [75.1, 11.6, 76, 12.3], level: 4, footprintKm: 50 },
  { id: 'kasaragod', name: 'Kasaragod', region: 'Kerala', kind: 'district', lat: 12.5, lon: 75, bbox: [74.7, 12.1, 75.5, 12.8], level: 4, footprintKm: 50 },
  { id: 'thiruvananthapuram-district', name: 'Thiruvananthapuram', region: 'Kerala', kind: 'district', lat: 8.5, lon: 77, bbox: [76.6, 8.2, 77.4, 8.9], level: 4, footprintKm: 60 },
  { id: 'kollam', name: 'Kollam', region: 'Kerala', kind: 'district', lat: 8.9, lon: 76.9, bbox: [76.4, 8.6, 77.3, 9.2], level: 4, footprintKm: 55 },

  // Cities
  { id: 'new-delhi', name: 'New Delhi', region: 'India', kind: 'city', lat: 28.61, lon: 77.21, bbox: [77.1, 28.5, 77.35, 28.7], level: 4, footprintKm: 25 },
  { id: 'mumbai', name: 'Mumbai', region: 'India', kind: 'city', lat: 19.08, lon: 72.88, bbox: [72.75, 18.85, 73.05, 19.25], level: 4, footprintKm: 30 },
  { id: 'bengaluru', name: 'Bengaluru', region: 'India', kind: 'city', lat: 12.97, lon: 77.59, bbox: [77.45, 12.85, 77.75, 13.1], level: 4, footprintKm: 30 },
  { id: 'chennai', name: 'Chennai', region: 'India', kind: 'city', lat: 13.08, lon: 80.27, bbox: [80.1, 12.9, 80.35, 13.2], level: 4, footprintKm: 25 },
  { id: 'kolkata', name: 'Kolkata', region: 'India', kind: 'city', lat: 22.57, lon: 88.36, bbox: [88.2, 22.4, 88.5, 22.7], level: 4, footprintKm: 25 },
  { id: 'kochi', name: 'Kochi', region: 'Kerala, India', kind: 'city', lat: 9.97, lon: 76.28, bbox: [76.2, 9.9, 76.35, 10.05], level: 4, footprintKm: 18 },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram city', region: 'Kerala, India', kind: 'city', lat: 8.52, lon: 76.94, bbox: [76.85, 8.4, 77.05, 8.65], level: 4, footprintKm: 18 },
  { id: 'london', name: 'London', region: 'United Kingdom', kind: 'city', lat: 51.5, lon: -0.12, bbox: [-0.3, 51.35, 0.1, 51.6], level: 4, footprintKm: 30 },
  { id: 'new-york', name: 'New York', region: 'United States', kind: 'city', lat: 40.71, lon: -74.01, bbox: [-74.1, 40.6, -73.8, 40.9], level: 4, footprintKm: 30 },
  { id: 'tokyo', name: 'Tokyo', region: 'Japan', kind: 'city', lat: 35.68, lon: 139.69, bbox: [139.6, 35.6, 139.85, 35.8], level: 4, footprintKm: 35 },
  { id: 'nairobi', name: 'Nairobi', region: 'Kenya', kind: 'city', lat: -1.29, lon: 36.82, bbox: [36.7, -1.4, 36.95, -1.2], level: 4, footprintKm: 25 },
  { id: 'sao-paulo', name: 'São Paulo', region: 'Brazil', kind: 'city', lat: -23.55, lon: -46.63, bbox: [-46.8, -23.7, -46.4, -23.4], level: 4, footprintKm: 40 },
  { id: 'cairo', name: 'Cairo', region: 'Egypt', kind: 'city', lat: 30.04, lon: 31.24, bbox: [31.1, 29.9, 31.4, 30.15], level: 4, footprintKm: 30 },
  { id: 'jakarta', name: 'Jakarta', region: 'Indonesia', kind: 'city', lat: -6.2, lon: 106.85, bbox: [106.7, -6.3, 106.95, -6.1], level: 4, footprintKm: 35 },
  { id: 'sydney', name: 'Sydney', region: 'Australia', kind: 'city', lat: -33.87, lon: 151.21, bbox: [151.1, -33.95, 151.3, -33.75], level: 4, footprintKm: 30 },
  { id: 'reykjavik', name: 'Reykjavík', region: 'Iceland', kind: 'city', lat: 64.15, lon: -21.94, bbox: [-22.1, 64.05, -21.75, 64.25], level: 4, footprintKm: 15 },
  { id: 'singapore', name: 'Singapore', kind: 'city', lat: 1.35, lon: 103.82, bbox: [103.6, 1.15, 104.1, 1.5], level: 4, footprintKm: 25 },
  { id: 'dubai', name: 'Dubai', region: 'United Arab Emirates', kind: 'city', lat: 25.2, lon: 55.27, bbox: [55.1, 25, 55.4, 25.35], level: 4, footprintKm: 25 },
  { id: 'lagos', name: 'Lagos', region: 'Nigeria', kind: 'city', lat: 6.52, lon: 3.38, bbox: [3.2, 6.4, 3.5, 6.65], level: 4, footprintKm: 30 },
  { id: 'los-angeles', name: 'Los Angeles', region: 'United States', kind: 'city', lat: 34.05, lon: -118.24, bbox: [-118.5, 33.9, -118.1, 34.2], level: 4, footprintKm: 40 },
  { id: 'mexico-city', name: 'Mexico City', region: 'Mexico', kind: 'city', lat: 19.43, lon: -99.13, bbox: [-99.3, 19.2, -98.9, 19.6], level: 4, footprintKm: 35 },
  { id: 'moscow', name: 'Moscow', region: 'Russia', kind: 'city', lat: 55.75, lon: 37.62, bbox: [37.4, 55.6, 37.85, 55.9], level: 4, footprintKm: 35 },
  { id: 'beijing', name: 'Beijing', region: 'China', kind: 'city', lat: 39.9, lon: 116.4, bbox: [116.2, 39.7, 116.6, 40.1], level: 4, footprintKm: 40 },
  { id: 'cape-town', name: 'Cape Town', region: 'South Africa', kind: 'city', lat: -33.92, lon: 18.42, bbox: [18.3, -34.1, 18.6, -33.8], level: 4, footprintKm: 30 },
]

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))

export function searchPlaces(query: string, limit = 8): Place[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const kindRank: Record<string, number> = {
    continent: 1,
    country: 2,
    state: 3,
    district: 4,
    city: 5,
    town: 6,
    global: 0,
    point: 7,
  }
  return PLACES.filter((p) => p.id !== 'global')
    .map((p) => {
      const name = p.name.toLowerCase()
      const region = (p.region ?? '').toLowerCase()
      let score = 0
      if (name === q) score = 100
      else if (name.startsWith(q)) score = 80
      else if (name.includes(q)) score = 60
      else if (region.includes(q)) score = 30
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (kindRank[a.p.kind] ?? 9) - (kindRank[b.p.kind] ?? 9) || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p)
}

/** Closest curated place for a clicked point, or a synthetic point. */
export function placeForPoint(lat: number, lon: number): Place {
  let best: Place | null = null
  let bestDistance = Infinity
  for (const p of PLACES) {
    if (p.kind === 'continent' || p.kind === 'global') continue
    const [w, s, e, n] = p.bbox
    const inside = lon >= w && lon <= e && lat >= s && lat <= n
    if (inside) {
      const d = Math.hypot(p.lat - lat, p.lon - lon)
      if (d < bestDistance) {
        bestDistance = d
        best = p
      }
    }
  }
  if (best && bestDistance < 6) return best

  const span = 0.6
  return {
    id: `point-${lat.toFixed(3)}-${lon.toFixed(3)}`,
    name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`,
    region: 'Free map point',
    kind: 'point',
    lat,
    lon,
    bbox: [lon - span, lat - span, lon + span, lat + span],
    level: 4,
    footprintKm: 120,
    blurb: 'A point you selected on the globe. Values describe the surrounding dataset grid cell.',
  }
}
