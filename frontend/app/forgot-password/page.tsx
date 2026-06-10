"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabaseClient";
import Logo from "../../components/brand/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) throw error;
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      <div className="absolute inset-0 radial-glow-purple pointer-events-none" />

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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Reset your password</h1>
            <p className="text-zinc-500 text-xs mt-1">Enter your account email to receive reset instructions.</p>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-green-950/20 border border-green-500/30 text-xs text-green-400 font-semibold">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-400 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="flex flex-col gap-5">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3.5 rounded-lg text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_15px_rgba(234,88,12,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>

        <p className="text-zinc-500 text-xs text-center mt-6">
          Remember your password?{' '}
          <Link href="/login" className="text-orange-500 hover:text-orange-400 font-bold">
            Back to Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}