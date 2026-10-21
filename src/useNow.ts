import { useEffect, useState } from 'react'

// Giờ hiện tại, tự cập nhật 10 lần mỗi giây cho tới lúc `until` (lúc hết giờ) thì dừng.
// `until` là null khi đồng hồ không chạy: khỏi cập nhật cho đỡ tốn pin.
export function useNow(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until === null) return
    const tick = () => {
      const time = Date.now()
      setNow(time)
      if (time >= until) clearInterval(timer)
    }
    const timer = setInterval(tick, 100)
    tick()
    return () => clearInterval(timer)
  }, [until])

  return now
}
