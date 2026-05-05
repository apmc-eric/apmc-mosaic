'use client'

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'

interface PageLoadingContextType {
  setPageLoading: (key: string, loading: boolean) => void
  isAnyPageLoading: boolean
}

const PageLoadingContext = createContext<PageLoadingContextType>({
  setPageLoading: () => {},
  isAnyPageLoading: false,
})

export function PageLoadingProvider({ children }: { children: React.ReactNode }) {
  const loadingKeysRef = useRef<Set<string>>(new Set())
  const [isAnyPageLoading, setIsAnyPageLoading] = useState(false)

  const setPageLoading = useCallback((key: string, loading: boolean) => {
    if (loading) {
      loadingKeysRef.current.add(key)
    } else {
      loadingKeysRef.current.delete(key)
    }
    setIsAnyPageLoading(loadingKeysRef.current.size > 0)
  }, [])

  return (
    <PageLoadingContext.Provider value={{ setPageLoading, isAnyPageLoading }}>
      {children}
    </PageLoadingContext.Provider>
  )
}

/**
 * Register this page's loading state with the global full-screen loader.
 * Uses useLayoutEffect so the initial `loading=true` blocks the first paint.
 */
export function usePageLoading(key: string, loading: boolean) {
  const { setPageLoading } = useContext(PageLoadingContext)

  useLayoutEffect(() => {
    setPageLoading(key, loading)
    return () => setPageLoading(key, false)
  }, [key, loading, setPageLoading])
}

export function useIsAnyPageLoading() {
  return useContext(PageLoadingContext).isAnyPageLoading
}
