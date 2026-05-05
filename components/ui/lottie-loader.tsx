'use client'

import Lottie from 'lottie-react'
import loaderAnimation from '@/public/loader.json'

export function LottieLoader({ className }: { className?: string }) {
  return (
    <Lottie
      animationData={loaderAnimation}
      loop
      autoplay
      className={className}
      style={{ width: 120, height: 120 }}
    />
  )
}
