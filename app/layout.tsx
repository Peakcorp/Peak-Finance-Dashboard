import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Peak Finance Dashboard',
  description: 'Executive mortgage production, pipeline, and projections dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
