import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // Auth sayfaları — oturum açıksa yönlendir
  if (['/login', '/register'].includes(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // API auth rotaları — her zaman izin ver
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // API register rotası — her zaman izin ver
  if (pathname === '/api/register') {
    return NextResponse.next()
  }

  // Korumalı rotalar — oturum açık değilse yönlendir
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)'],
}
