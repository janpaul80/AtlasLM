import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

const getRequestOrigin = (request: NextRequest) => {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()

  if (forwardedHost) {
    return `${forwardedProto || request.nextUrl.protocol.replace(':', '')}://${forwardedHost}`
  }

  return request.nextUrl.origin
}

const getSafeRedirectOrigin = (request: NextRequest, requestedOrigin: string | null) => {
  const requestOrigin = getRequestOrigin(request)

  if (!requestedOrigin) {
    return requestOrigin
  }

  try {
    const parsedRequestedOrigin = new URL(requestedOrigin)
    const parsedRequestOrigin = new URL(requestOrigin)
    const sameHost = parsedRequestedOrigin.hostname === parsedRequestOrigin.hostname
    const sameProtocol = parsedRequestedOrigin.protocol === parsedRequestOrigin.protocol
    const localhostPair =
      parsedRequestedOrigin.hostname === 'localhost' && parsedRequestOrigin.hostname === 'localhost'

    if (localhostPair) {
      return parsedRequestOrigin.origin
    }

    if (parsedRequestedOrigin.origin === parsedRequestOrigin.origin || (sameProtocol && sameHost)) {
      return parsedRequestedOrigin.origin
    }
  } catch {
    return requestOrigin
  }

  return requestOrigin
}

export async function GET(request: NextRequest) {
  try {
    const redirectOrigin = getSafeRedirectOrigin(request, request.nextUrl.searchParams.get('redirect_origin'))
    const callbackUrl = new URL('/auth/callback', redirectOrigin)
    callbackUrl.searchParams.set('redirect_origin', redirectOrigin)

    const supabase = await supabaseServer()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error ||!data.url) {
      console.error('Google OAuth start error:', error)
      return NextResponse.redirect(new URL('/login?error=oauth_start_failed', redirectOrigin))
    }

    return NextResponse.redirect(data.url)
  } catch (err) {
    console.error('Google OAuth route exception:', err)
    return NextResponse.redirect(new URL('/login?error=oauth_start_failed', getRequestOrigin(request)))
  }
}
