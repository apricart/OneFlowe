"use client"

import { useEffect } from 'react'
import { prefetchData } from '@/lib/hooks/use-api'

// Preload critical data when component mounts
export function PreloadData() {
  useEffect(() => {
    // Prefetch critical data in parallel
    const preloadCritical = async () => {
      try {
        await Promise.all([
          prefetchData.organizations(),
          prefetchData.users(),
          prefetchData.roles(),
        ])
      } catch (error) {
        console.warn('Failed to prefetch some data:', error)
      }
    }

    preloadCritical()
  }, [])

  return null // This component doesn't render anything
}

// Preload data for specific routes
export function PreloadDashboardData() {
  useEffect(() => {
    const preload = async () => {
      try {
        await Promise.all([
          prefetchData.organizations(),
          prefetchData.users(),
          prefetchData.roles(),
        ])
      } catch (error) {
        console.warn('Failed to prefetch dashboard data:', error)
      }
    }

    preload()
  }, [])

  return null
}
