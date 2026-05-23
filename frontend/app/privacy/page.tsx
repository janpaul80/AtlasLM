"use client";

import React from "react";
import { motion } from "framer-motion";
import Header from "../../components/layout/header";
import Footer from "../../components/layout/footer";

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-zinc-500 mb-8">Last Updated: May 23, 2026</p>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">1. Data Ownership & Sovereignty</h2>
            <p>
              At AtlasLM, we treat data ownership seriously. Unlike standard cloud AI products, your uploaded source files (PDFs, Markdown, TXT) and extracted chunks remain strictly yours. We do not sell, scan, or train proprietary models on your document corpus.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">2. Vector Encryption & Storage</h2>
            <p>
              Your source documents are parsed page-by-page, chunked, and converted into mathematical vector embeddings. These vectors are securely stored in our PostgreSQL + pgvector database instances. Database access is highly restricted and encrypted at rest.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">3. External AI Processing</h2>
            <p>
              To execute source-grounded chat and completions, context chunks are sent to your chosen AI model provider (such as Langdock, Blackbox AI, or OpenRouter). These transactions are executed via encrypted TLS connections and adhere to standard API data privacy policies (guaranteeing that model builders do not persist or train on API payloads).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">4. Security Baselines</h2>
            <p>
              For our cloud web app, user sessions are protected using Supabase Auth JWT credentials, enforcing granular row-level security policies on PostgreSQL tables, ensuring that no user can ever access or query workspaces belonging to another builder.
            </p>
          </section>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
