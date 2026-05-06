'use client'

import Lottie from 'lottie-react'
import animationData from '@/public/loading-animation.json'

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <Lottie
        animationData={animationData}
        loop
        autoplay
        style={{ width: 200, height: 91 }}
      />
    </div>
  )
}
