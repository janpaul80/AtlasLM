"use client";

import React from "react";
import { motion } from "framer-motion";
import Header from "../../components/layout/header";
import Footer from "../../components/layout/footer";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden">
      <div className="absolute inset-0 radial-glow pointer-events-none" />

      <Header />

      <main className="flex-grow pt-32 pb-24 px-6 max-w-3xl mx-auto relative z-10 w-full">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="prose prose-invert max-w-none text-zinc-400 text-sm leading-relaxed"
        >
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-8 border-b border-zinc-900 pb-4">
            Terms of Service
          </h1>
          <p className="text-zinc-500 mb-8">Last Updated: May 23, 2026</p>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using AtlasLM (the &quot;Service&quot;) through atlaslm.cloud, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, please do not utilize our platform or dashboards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">2. Service Scope & Notebook Usage</h2>
            <p>
              AtlasLM provides a RAG-based AI knowledge workspace dashboard allowing users to upload document files (PDFs, Markdown, TXT) and crawl URLs to execute source-grounded completions. You retain absolute ownership of all content and files ingested into your workspaces.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">3. API Model Configurations</h2>
            <p>
              When utilizing model provider integrations (including our premium AI providers, Blackbox AI, OpenRouter, and Ollama), you agree to abide by the respective usage terms and billing parameters of those third-party providers. We are not responsible for model pricing changes or service failures originating from external providers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">4. Prohibited Content</h2>
            <p>
              You may not ingest documents that violate local, national, or international laws, or that contain malicious code, viral scripts, or unauthorized proprietary information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">5. Modifications to Service</h2>
            <p>
              We reserve the right to modify, suspend, or terminate the commercial or cloud services of AtlasLM at any time, with reasonable warning given to paying subscription tiers.
            </p>
          </section>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
