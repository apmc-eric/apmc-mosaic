import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Instrument_Serif } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: '--font-inter' })
const _instrumentSerif = Instrument_Serif({ 
  weight: '400',
  subsets: ["latin"], 
  variable: '--font-instrument-serif' 
})

export const metadata: Metadata = {
  title: 'Mosaic',
  description: 'Internal design inspiration board for your team',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${_inter.variable} ${_instrumentSerif.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster position="bottom-right" />
        <Analytics />
      </body>
    </html>
  )
}
