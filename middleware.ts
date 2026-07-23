import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Always call getUser() immediately — required for session refresh
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  function redirect(dest: string) {
    const url = request.nextUrl.clone()
    url.pathname = dest
    url.search = ''
    const res = NextResponse.redirect(url)
    // Copy session cookies so the redirect doesn't break the session
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
    return res
  }

  // Unauthenticated guards
  if (!user) {
    if (pathname.startsWith('/dashboard')) return redirect('/login')
    if (pathname.startsWith('/apply')) {
      const url = request.nextUrl.clone()
      url.pathname = '/signup'
      url.searchParams.set('next', '/apply')
      const res = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
      return res
    }
    if (pathname.startsWith('/admin')) return redirect('/login')
    return supabaseResponse
  }

  // Role-based guard for admin
  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'reviewer'].includes(profile.role)) {
      return redirect('/dashboard')
    }
  }

  // Redirect authenticated users away from auth pages
  if (pathname === '/login' || pathname === '/signup') {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    const dest = ['admin', 'reviewer'].includes(profile?.role ?? '') ? '/admin' : '/dashboard'
    return redirect(dest)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|public|.*\\..*).*)', '/'],
}
