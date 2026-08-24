import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'

const ADMIN_ONLY_PREFIXES = ['/admin/equipe', '/admin/services', '/admin/statistiques', '/admin/galerie']

export default auth((req) => {
  const { nextUrl } = req
  const role = req.auth?.user?.role

  if (nextUrl.pathname.startsWith('/admin')) {
    if (!role || (role !== 'COIFFEUR' && role !== 'ADMIN')) {
      const url = new URL('/connexion', nextUrl)
      url.searchParams.set('redirect', nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    if (ADMIN_ONLY_PREFIXES.some((prefix) => nextUrl.pathname.startsWith(prefix)) && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/planning', nextUrl))
    }
  }

  if (nextUrl.pathname.startsWith('/compte') && !role) {
    const url = new URL('/connexion', nextUrl)
    url.searchParams.set('redirect', nextUrl.pathname)
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ['/admin/:path*', '/compte/:path*'],
}
