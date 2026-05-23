"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "../components/layout/header";
import Footer from "../components/layout/footer";

export default function Home() {
  // SVG Icons (Professional, no emojis)
  const ShieldIcon = () => (
    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );

  const CitationsIcon = () => (
    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  const CpuIcon = () => (
    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden">
      {/* Premium Cinematic Glowing Backdrops */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      <div className="absolute inset-0 radial-glow-purple pointer-events-none" />
      
      <Header />

      {/* Main Hero Section */}
      <main className="flex-grow pt-32 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
        
        {/* Top Product Announcement Tag */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-950/20 text-xs font-semibold text-orange-400 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Introducing AtlasLM Cloud v1.0
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.1] mb-6"
        >
          Your Source-Grounded <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-red-500 to-amber-500">
            AI Research Notebook
          </span>
        </motion.h1>

        {/* Hero Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-base md:text-xl text-zinc-400 max-w-2xl leading-relaxed mb-10"
        >
          Analyze PDFs, markdown documents, and URLs in complete security. AtlasLM provides mathematically verifiable source citations, zero hallucinations, and absolute model freedom.
        </motion.p>

        {/* Primary CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-20"
        >
          <Link
            href="/dashboard"
            className="w-full sm:w-auto text-center px-8 py-4 rounded-xl font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-colors duration-250 shadow-lg shadow-white/5"
          >
            Launch Free Notebook
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto text-center px-8 py-4 rounded-xl font-bold border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-all duration-250"
          >
            View Pricing Tiers
          </Link>
        </motion.div>

        {/* Landing Page Visual Teaser Dashboard Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="w-full max-w-5xl rounded-2xl glass-panel p-2 shadow-2xl shadow-black/80 relative mb-32"
        >
          <div className="w-full h-[320px] md:h-[500px] rounded-xl bg-zinc-950/90 border border-zinc-800/60 overflow-hidden flex flex-col justify-between p-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="text-xs text-zinc-600 font-mono ml-4">workspace://research-deep-learning</span>
              </div>
              <span className="text-xs bg-zinc-900 text-zinc-400 px-3 py-1 rounded border border-zinc-800">
                Model: Langdock GPT-4o
              </span>
            </div>
            
            {/* Visual Chat Screen Teaser */}
            <div className="flex-grow flex items-center justify-center">
              <div className="max-w-xl text-center flex flex-col gap-3">
                <p className="text-zinc-600 text-sm">Drag and drop source PDFs, markdown files, or URLs to begin grounded research.</p>
                <div className="flex justify-center gap-4">
                  <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">PDF Ingestion</div>
                  <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">Verifiable Citations</div>
                  <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400">Self-Hosting Framework</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 text-left mb-16">
          
          <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/50 hover:border-zinc-800 transition-colors">
            <div className="p-3 bg-orange-950/20 border border-orange-500/20 rounded-xl w-fit mb-6">
              <ShieldIcon />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Absolute Source-Grounding</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Strictly restricted retrieval structures guarantee that the AI answers *only* using your uploaded documents. Hallucinations are actively blocked.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/50 hover:border-zinc-800 transition-colors">
            <div className="p-3 bg-orange-950/20 border border-orange-500/20 rounded-xl w-fit mb-6">
              <CitationsIcon />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Interactive Page-level Citations</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Clickable inline citation pills link every sentence directly back to specific pages and source snippets in your PDF workspace.
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-zinc-900 bg-zinc-950/50 hover:border-zinc-800 transition-colors">
            <div className="p-3 bg-orange-950/20 border border-orange-500/20 rounded-xl w-fit mb-6">
              <CpuIcon />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multi-Model Orchestration</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Connect our backend seamlessly to your own Langdock pipelines, Blackbox models, OpenRouter keys, or fully local Ollama runtimes.
            </p>
          </div>

        </section>

        {/* Android App CTA Banner */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-5xl rounded-3xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-zinc-900/40 to-zinc-950 p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 mb-20 relative overflow-hidden group"
        >
          {/* Subtle green glow in background */}
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-green-500/5 rounded-full blur-3xl pointer-events-none transition-all duration-500 group-hover:bg-green-500/10" />
          
          <div className="flex flex-col text-left max-w-xl">
            <span className="text-[10px] uppercase font-bold tracking-widest text-green-400 mb-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.523 15.3c-.551 0-1.002-.445-1.002-.996 0-.552.451-1 .1-1 .552 0 1 .448 1 1 0 .551-.448.996-.998.996zm-11.046 0c-.551 0-1-.445-1-.996 0-.552.449-1 .998-1 .552 0 1 .448 1 1 0 .551-.448.996-.998.996zm11.417-6.071l2.003-3.472a.498.498 0 0 0-.183-.681.498.498 0 0 0-.681.183l-2.018 3.498a10.937 10.937 0 0 0-7.036 0L5.964 5.257a.496.496 0 0 0-.68-.183.498.498 0 0 0-.183.681l2.002 3.472C3.216 11.237 1 14.364 1 18h22c0-3.636-2.216-6.763-6.096-8.771z" />
              </svg>
              Android Platform
            </span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
              Research Anywhere with AtlasLM Mobile
            </h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Access your grounded workspaces, interact with page citations, and upload sources directly from your Android device. 100% native, secure backend routing, and zero embedded keys.
            </p>
          </div>

          <div className="flex flex-col items-center sm:items-start md:items-end gap-2 shrink-0">
            <Link
              href="/download/android"
              className="inline-flex items-center gap-3 px-6 py-4 rounded-xl font-bold bg-zinc-900 border border-zinc-850 text-zinc-350 hover:text-white hover:bg-zinc-800 transition-all duration-200 shadow-md group-hover:border-zinc-750"
            >
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.523 15.3c-.551 0-1.002-.445-1.002-.996 0-.552.451-1 .1-1 .552 0 1 .448 1 1 0 .551-.448.996-.998.996zm-11.046 0c-.551 0-1-.445-1-.996 0-.552.449-1 .998-1 .552 0 1 .448 1 1 0 .551-.448.996-.998.996zm11.417-6.071l2.003-3.472a.498.498 0 0 0-.183-.681.498.498 0 0 0-.681.183l-2.018 3.498a10.937 10.937 0 0 0-7.036 0L5.964 5.257a.496.496 0 0 0-.68-.183.498.498 0 0 0-.183.681l2.002 3.472C3.216 11.237 1 14.364 1 18h22c0-3.636-2.216-6.763-6.096-8.771z" />
              </svg>
              Install Android App
            </Link>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wide">
              Android APK coming soon
            </span>
          </div>
        </motion.div>

      </main>

      <Footer />
    </div>
  );
}
