import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'

function ScaledViewport({ children }: { children: ReactNode }) {
  const BASE_WIDTH = 1536
  const BASE_HEIGHT = 864
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  useEffect(() => {
    let frame = 0
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const nextIsMobile = w < 1024
      const nextScale = Math.max(0.68, Math.min(1, w / BASE_WIDTH, h / BASE_HEIGHT))

      setIsMobile((current) => (current === nextIsMobile ? current : nextIsMobile))
      setScale((current) => (Math.abs(current - nextScale) < 0.001 ? current : nextScale))
    }
    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        update()
      })
    }

    update()
    window.addEventListener('resize', scheduleUpdate, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  if (isMobile) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden" style={{ background: '#fcfcfc' }}>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen w-screen overflow-x-hidden" style={{ background: '#fcfcfc' }}>
      <div
        style={{
          width: scale < 1 ? `${100 / scale}%` : '100%',
          transformOrigin: 'top left',
          transform: scale < 1 ? `scale(${scale})` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: () => (
    <ScaledViewport>
      <div className="min-h-screen bg-[#fcfcfc] selection:bg-orange-500 selection:text-white">
        <Outlet />
      </div>
    </ScaledViewport>
  ),
})
