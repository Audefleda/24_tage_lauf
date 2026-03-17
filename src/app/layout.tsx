import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { AppHeader } from '@/components/app-header'
import './globals.css'

export const metadata: Metadata = {
  title: '24 Tage Lauf',
  description: 'Laeufe eintragen und verwalten',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="antialiased min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  )
}
