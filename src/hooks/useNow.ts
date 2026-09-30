import { useEffect, useState } from 'react'

/** Current time, re-rendering every `everyMs` (for "updated 2 min ago" labels). */
export function useNow(everyMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(t)
  }, [everyMs])
  return now
}
