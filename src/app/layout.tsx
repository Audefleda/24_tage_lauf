import type { Metadata } from 'next'
import { Work_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { AppHeader } from '@/components/app-header'
import './globals.css'

const workSans = Work_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-work-sans',
})

export const metadata: Metadata = {
  title: '24 Tage Lauf',
  description: 'Läufe eintragen und verwalten',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={workSans.variable} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  )
}
