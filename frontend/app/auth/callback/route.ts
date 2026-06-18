// Server-only OAuth handler. Not part of the mobile static export.
export const dynamic = process.env.BUILD_TARGET === "mobile" ? "force-static" : "force-dynamic";

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
    const localhostPair = parsedRequestedOrigin.hostname === 'localhost' && parsedRequestOrigin.hostname === 'localhost'

    // For local development, always keep callback redirects on the current request origin
    // to avoid stale localhost port mismatches (e.g. 3010 vs 3000).
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

const redirectTo = (request: NextRequest, path: string, origin?: string) => {
  return NextResponse.redirect(new URL(path, origin || getRequestOrigin(request)))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')
    const redirectOrigin = getSafeRedirectOrigin(request, searchParams.get('redirect_origin'))

    if (!code) {
      return redirectTo(request, '/login?error=missing_code', redirectOrigin)
    }

    const supabase = await supabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('OAuth callback error:', error)
      return redirectTo(request, '/login?error=auth_callback_failed', redirectOrigin)
    }

    return redirectTo(request, '/dashboard', redirectOrigin)
  } catch (err) {
    console.error('Callback exception:', err)
    return redirectTo(request, '/login?error=auth_callback_failed')
  }
}
