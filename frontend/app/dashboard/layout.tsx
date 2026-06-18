import React from 'react'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabaseServer'
import UserMenu from '@/components/UserMenu'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (process.env.BUILD_TARGET !== 'mobile') {
    const supabase = await supabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
          AtlasLM Dashboard
        </h1>
        <UserMenu />
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}