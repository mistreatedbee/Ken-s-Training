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

  // Required to keep the session alive — must be called before any redirect
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  function redirect(dest: string) {
    const url = request.nextUrl.clone()
    url.pathname = dest
    url.search = ''
    const res = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => res.cookies.set(name, value))
    return res
  }

  if (pathname.startsWith('/admin') && !user) return redirect('/login')
  if (pathname === '/login' && user) return redirect('/admin')

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|public|.*\\..*).*)', '/'],
}
