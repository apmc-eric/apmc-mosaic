'use client'

import Lottie from 'lottie-react'
import loaderAnimation from '@/public/loader.json'

export function LottieLoader() {
  return (
    <Lottie
      animationData={loaderAnimation}
      loop
      autoplay
      style={{ width: 400, height: 182 }}
    />
  )
}
