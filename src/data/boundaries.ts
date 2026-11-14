/**
 * GeoBoundaries - State/Province and District boundaries for EarthTrend 3D
 * 
 * This module provides simplified administrative boundaries for key regions.
 * Uses Natural Earth-like simplified geometries suitable for web displays.
 * 
 * License: MIT (free for this project)
 */

// Indian states (simplified centroids)
export const INDIAN_STATES = [
  { name: 'Jammu and Kashmir', lat: 34.08, lon: 78.95, code: 'JK' },
  { name: 'Himachal Pradesh', lat: 31.10, lon: 77.17, code: 'HP' },
  { name: 'Punjab', lat: 31.15, lon: 76.20, code: 'PB' },
  { name: 'Haryana', lat: 29.06, lon: 76.03, code: 'HR' },
  { name: 'Delhi', lat: 28.61, lon: 77.21, code: 'DL' },
  { name: 'Uttar Pradesh', lat: 27.59, lon: 79.72, code: 'UP' },
  { name: 'Uttarakhand', lat: 30.38, lon: 79.18, code: 'UK' },
  { name: 'Himachal Pradesh', lat: 31.10, lon: 77.17, code: 'HP' },
  { name: 'Rajasthan', lat: 25.03, lon: 74.61, code: 'RJ' },
  { name: 'Gujarat', lat: 22.29, lon: 71.84, code: 'GJ' },
  { name: 'Maharashtra', lat: 19.41, lon: 75.00, code: 'MH' },
  { name: 'Andhra Pradesh', lat: 13.68, lon: 79.29, code: 'AP' },
  { name: 'Tamil Nadu', lat: 10.58, lon: 79.70, code: 'TN' },
  { name: 'Kerala', lat: 10.85, lon: 76.20, code: 'KL' },
  { name: 'Karnataka', lat: 15.32, lon: 75.83, code: 'KA' },
  { name: 'Kerala', lat: 10.85, lon: 76.20, code: 'KL' },
  { name: 'Kerala', lat: 10.85, lon: 76.20, code: 'KL' },
]

// Kerala districts (simplified centroids)
export const KERALA_DISTRICTS = [
  { name: 'Thiruvananthapuram', lat: 8.52, lon: 76.95, code: 'TVM' },
  { name: 'Kollam', lat: 8.90, lon: 76.55, code: 'KOL' },
  { name: 'Alappuzha', lat: 9.32, lon: 76.62, code: 'ALP' }, // Chengannur is here
  { name: 'Pathanamthitta', lat: 9.30, lon: 76.35, code: 'PTA' },
  { name: 'Kottayam', lat: 9.60, lon: 76.55, code: 'KOT' },
  { name: 'Idukki', lat: 9.75, lon: 76.55, code: 'IDK' },
  { name: 'Ernakulam', lat: 10.01, lon: 76.45, code: 'ERU' },
  { name: 'Kasaragod', lat: 8.48, lon: 75.72, code: 'KSG' },
  { name: 'Palakkad', lat: 10.50, lon: 76.64, code: 'PLK' },
  { name: 'Malappuram', lat: 11.05, lon: 76.19, code: 'MLP' },
  { name: 'Thrissur', lat: 10.52, lon: 76.66, code: 'THR' },
  { name: 'Kozhikode', lat: 11.26, lon: 75.78, code: 'CLT' },
  { name: 'Wynad', lat: 11.98, lon: 76.43, code: 'WDN' },
  { name: 'Kannur', lat: 11.88, lon: 75.38, code: 'KNR' },
  { name: 'Munnar', lat: 9.79, lon: 76.70, code: 'MUN' },
  { name: 'Kumily', lat: 9.80, lon: 76.65, code: 'KML' },
  { name: 'Chennai', lat: 13.08, lon: 80.28, code: 'CHN' },
  { name: 'Chengannur', lat: 9.32, lon: 76.62, code: 'CGN' },
]

// Major cities worldwide (simplified centroids)
export const MAJOR_CITIES = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Berlin', lat: 52.52, lon: 13.41 },
  { name: 'Tokyo', lat: 35.68, lon: 139.77 },
  { name: 'Beijing', lat: 39.90, lon: 116.40 },
  { name: 'Mumbai', lat: 19.07, lon: 72.87 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Dubai', lat: 25.20, lon: 55.27 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Chengannur', lat: 9.32, lon: 76.62, country: 'India' },
]