import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LOBBY AI — Kurumsal İletişim Asistanı',
  description: 'Lobby İletişim ajansı için yapay zeka destekli doküman üretim platformu',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className={`${inter.className} h-full`}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
