"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Logo from "../../components/brand/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // Supabase Auth Integration hook baseline
      // You can wire up standard client:
      // const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      // For instant local verification and premium experience:
      setTimeout(() => {
        setLoading(false);
        router.push("/dashboard");
      }, 1000);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to log in.");
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
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome Back</h1>
            <p className="text-zinc-500 text-xs mt-1">Enter your credentials to access your workspaces.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-400 font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Password
              </label>
              <Link href="/login" className="text-[10px] font-bold text-orange-500 hover:text-orange-400">
                Forgot password?
              </Link>
            </div>
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-3.5 rounded-lg text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_15px_rgba(234,88,12,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <p className="text-zinc-500 text-xs text-center mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-bold">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
