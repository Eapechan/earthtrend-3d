/**
 * GeoNames - Country labels for Cesium globe
 * 
 * This module provides country name labels that appear at appropriate zoom levels.
 * Uses simplified Natural Earth-like data for major countries.
 * 
 * License: MIT (free for this project)
 */

// Major countries with simplified coordinates (approximate centroids)
export const COUNTRIES = [
  { name: 'United States', lat: 39.83, lon: -98.58, iso: 'US' },
  { name: 'Canada', lat: 56.13, lon: -106.35, iso: 'CA' },
  { name: 'Mexico', lat: 23.63, lon: -102.55, iso: 'MX' },
  { name: 'Brazil', lat: -14.23, lon: -51.93, iso: 'BR' },
  { name: 'Argentina', lat: -38.42, lon: -63.62, iso: 'AR' },
  { name: 'Chile', lat: -35.68, lon: -71.50, iso: 'CL' },
  { name: 'Colombia', lat: 4.57, lon: -74.29, iso: 'CO' },
  { name: 'Peru', lat: -9.57, lon: -71.93, iso: 'PE' },
  { name: 'Venezuela', lat: 6.42, lon: -66.59, iso: 'VE' },
  { name: 'China', lat: 35.86, lon: 104.20, iso: 'CN' },
  { name: 'India', lat: 20.59, lon: 78.96, iso: 'IN' },
  { name: 'Pakistan', lat: 30.84, lon: 73.68, iso: 'PK' },
  { name: 'Bangladesh', lat: 23.68, lon: 90.41, iso: 'BD' },
  { name: 'Nepal', lat: 28.16, lon: 84.09, iso: 'NP' },
  { name: 'Myanmar', lat: 20.85, lon: 98.33, iso: 'MM' },
  { name: 'Thailand', lat: 10.58, lon: 98.89, iso: 'TH' },
  { name: 'Indonesia', lat: -1.47, lon: 114.79, iso: 'ID' },
  { name: 'Australia', lat: -25.28, lon: 133.78, iso: 'AU' },
  { name: 'New Zealand', lat: -40.90, lon: 173.86, iso: 'NZ' },
  { name: 'Japan', lat: 36.20, lon: 138.25, iso: 'JP' },
  { name: 'South Korea', lat: 35.91, lon: 127.76, iso: 'KR' },
  { name: 'Russia', lat: 61.52, lon: 105.32, iso: 'RU' },
  { name: 'Turkey', lat: 38.97, lon: 35.24, iso: 'TR' },
  { name: 'Iran', lat: 32.43, lon: 53.69, iso: 'IR' },
  { name: 'Saudi Arabia', lat: 23.89, lon: 45.08, iso: 'SA' },
  { name: 'United Arab Emirates', lat: 23.42, lon: 53.85, iso: 'AE' },
  { name: 'Egypt', lat: 26.82, lon: 30.80, iso: 'EG' },
  { name: 'South Africa', lat: -30.56, lon: 22.94, iso: 'ZA' },
  { name: 'Nigeria', lat: 9.08, lon: 8.68, iso: 'NG' },
  { name: 'Kenya', lat: -0.43, lon: 37.72, iso: 'KE' },
  { name: 'Ethiopia', lat: 9.03, lon: 40.68, iso: 'ET' },
  { name: 'Algeria', lat: 28.03, lon: 1.66, iso: 'DZ' },
  { name: 'Morocco', lat: 32.22, lon: -5.50, iso: 'MA' },
  { name: 'France', lat: 46.23, lon: 2.21, iso: 'FR' },
  { name: 'Spain', lat: 40.46, lon: -3.75, iso: 'ES' },
  { name: 'Italy', lat: 41.87, lon: 12.57, iso: 'IT' },
  { name: 'Germany', lat: 51.17, lon: 10.45, iso: 'DE' },
  { name: 'United Kingdom', lat: 55.38, lon: -3.24, iso: 'GB' },
  { name: 'Netherlands', lat: 52.28, lon: 5.96, iso: 'NL' },
  { name: 'Sweden', lat: 63.93, lon: 16.64, iso: 'SE' },
  { name: 'Norway', lat: 60.47, lon: 8.95, iso: 'NO' },
  { name: 'Finland', lat: 63.99, lon: 25.67, iso: 'FI' },
  { name: 'Canada', lat: 56.13, lon: -106.35, iso: 'CA' },
  { name: 'Mexico', lat: 23.63, lon: -102.55, iso: 'MX' },
  { name: 'Argentina', lat: -38.42, lon: -63.62, iso: 'AR' },
  { name: 'Chile', lat: -35.68, lon: -71.50, iso: 'CL' },
  { name: 'Colombia', lat: 4.57, lon: -74.29, iso: 'CO' },
  { name: 'Peru', lat: -9.57, lon: -71.93, iso: 'PE' },
  { name: 'Venezuela', lat: 6.42, lon: -66.59, iso: 'VE' },
  { name: 'Poland', lat: 51.92, lon: 19.14, iso: 'PL' },
  { name: 'Ukraine', lat: 48.38, lon: 31.18, iso: 'UA' },
  { name: 'Romania', lat: 46.30, lon: 24.75, iso: 'RO' },
  { name: 'Hungary', lat: 47.17, lon: 19.10, iso: 'HU' },
  { name: 'Belgium', lat: 50.50, lon: 4.47, iso: 'BE' },
  { name: 'Austria', lat: 47.52, lon: 13.41, iso: 'AT' },
  { name: 'Switzerland', lat: 46.82, lon: 8.23, iso: 'CH' },
  { name: 'India', lat: 20.59, lon: 78.96, iso: 'IN' },
]

// Continent centroids for labeling
export const CONTINENTS = [
  { name: 'Africa', lat: 9.67, lon: 21.00 },
  { name: 'Europe', lat: 54.53, lon: 17.77 },
  { name: 'Asia', lat: 36.72, lon: 87.58 },
  { name: 'North America', lat: 40.79, lon: -99.42 },
  { name: 'South America', lat: -13.68, lon: -62.73 },
  { name: 'Australia', lat: -18.20, lon: 133.85 },
  { name: 'Antarctica', lat: -75.00, lon: 0.00 },
]