"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Logo from "../../components/brand/logo";
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      // Supabase Auth Integration hook baseline
      // You can wire up standard client:
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      setLoading(false);
      router.push('/dashboard');
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to create account.");
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      <div className="absolute inset-0 radial-glow-purple pointer-events-none" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-2xl glass-panel p-8 border border-zinc-900 bg-zinc-950/40 relative z-10"
      >
        <div className="flex flex-col items-center gap-6 mb-8 text-center">
          <Link href="/">
            <Logo size={40} showText={false} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Create Workspace Account</h1>
            <p className="text-zinc-500 text-xs mt-1">Get started with secure source-grounded research notebooks.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-400 font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Social Auth Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            type="button"
            onClick={() => alert("Google signup coming soon! OAuth integration in progress.")}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/80 hover:border-zinc-700 hover:scale-[1.02] transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => alert("GitHub signup coming soon! OAuth integration in progress.")}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-zinc-900/80 border border-zinc-800 text-sm font-semibold text-zinc-200 hover:bg-zinc-800/80 hover:border-zinc-700 hover:scale-[1.02] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-grow h-px bg-zinc-800" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">or continue with email</span>
          <div className="flex-grow h-px bg-zinc-800" />
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-5">
          {/* Email input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Create Password
            </label>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          {/* Confirm Password input */}
          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3.5 rounded-lg text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_15px_rgba(234,88,12,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-zinc-500 text-xs text-center mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 hover:text-orange-400 font-bold">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
