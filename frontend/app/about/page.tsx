"use client";

import React from "react";
import { motion } from "framer-motion";
import Header from "../../components/layout/header";
import Footer from "../../components/layout/footer";

export default function AboutPage() {
  const openSourceProjects = [
    {
      name: "KLAW",
      type: "Ecosystem Backbone",
      desc: "Robust developer framework orchestrating local intelligence nodes and offline security baselines.",
    },
    {
      name: "TokenKlaw",
      type: "Tokenization Engine",
      desc: "High-performance tokenizer and character encoder written to optimize LLM ingestion pipelines.",
    },
    {
      name: "GitRAG",
      type: "Developer Tooling",
      desc: "CLI utility that compiles codebase directories into context-ready maps for structural RAG pipelines.",
    },
  ];

  const activeProjects = [
    {
      name: "AtlasLM",
      category: "AI Workspace",
      desc: "Privacy-first research notebook providing page-aware PDF ingestion and source-grounded streaming.",
    },
    {
      name: "CoderXP",
      category: "Platform SaaS",
      desc: "Intelligent software platform aiding developers in building web applications asynchronously.",
    },
    {
      name: "HeftCoder AI",
      category: "Autonomous Systems",
      desc: "AI-driven autonomous coding assistant built to refactor code structures safely.",
    },
    {
      name: "KuikChat",
      category: "Communication",
      desc: "Sub-second real-time messaging pipeline built for customer-facing AI agents.",
    },
    {
      name: "Oye AI",
      category: "Orchestration",
      desc: "Natural language orchestration hub translating voice and text requests into server workflows.",
    },
    {
      name: "WhatsApp AI",
      category: "AI Integrations",
      desc: "Seamless, secure WhatsApp integration bridge linking client interactions directly to LLM brains.",
    },
    {
      name: "FileNinja",
      category: "Intelligent Tooling",
      desc: "Local file system utility utilizing smart tagging and metadata classification.",
    },
    {
      name: "Rev-Pro",
      category: "Ecosystem Platform",
      desc: "Production-grade developer automation platform optimizing continuous delivery.",
    },
  ];

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      <div className="absolute inset-0 radial-glow-purple pointer-events-none" />

      <Header />

      <main className="flex-grow pt-32 pb-24 px-6 max-w-5xl mx-auto relative z-10">
        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            The Builder Mentality
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            AtlasLM is built by engineers, for engineers. We believe in absolute privacy, model freedom, and solid developer ecosystems.
          </p>
        </motion.div>

        {/* Founder Bio Block */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start mb-24 pb-16 border-b border-zinc-900/60">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="md:col-span-1"
          >
            <div className="sticky top-24">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Founder Profile</span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2 mb-4">Paul Hartmann</h2>
              <p className="text-zinc-500 text-sm font-semibold mb-6">Software Engineer & Systems Architect</p>
              
              {/* Portfolio Link CTA */}
              <a
                href="https://paulhartmann.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-white font-bold bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-5 py-3 rounded-lg transition-all duration-250"
              >
                paulhartmann.dev
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="md:col-span-2 flex flex-col gap-6 text-zinc-400 text-base leading-relaxed"
          >
            <p>
              Paul Hartmann is an independent software engineer and AI systems builder focused on developer infrastructure, autonomous environments, and privacy-first intelligence layers. Recognizing the architectural limitations of heavily sandboxed cloud AI workspaces, Paul initiated AtlasLM to give builders absolute ownership of their data structures and computational nodes.
            </p>
            <p>
              His engineering background lies at the convergence of AI orchestration, high-performance RAG indexing, workflow automation, and self-hosted server deployments. Rather than shipping bloated wrappers, Paul focuses on writing lightweight, modular runtimes that execute securely inside local Docker layers or private virtual environments.
            </p>
            <p>
              Through a diverse portfolio of developer utilities and communication tools, his work demonstrates an active commitment to continuous building, technical ambition, and rigorous privacy-first standards in consumer AI ecosystems.
            </p>
          </motion.div>
        </section>

        {/* Open Source section */}
        <section className="mb-24">
          <div className="flex flex-col gap-3 mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Active Contributions</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white">Open-Source Initiatives</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {openSourceProjects.map((proj, idx) => (
              <motion.div
                key={proj.name}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="p-6 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-colors group"
              >
                <span className="text-xs text-orange-500 font-bold tracking-wider uppercase">{proj.type}</span>
                <h4 className="text-lg font-bold text-white mt-1 mb-2 group-hover:text-orange-400 transition-colors">{proj.name}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{proj.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* AI & SaaS Platforms section */}
        <section className="mb-16">
          <div className="flex flex-col gap-3 mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Ecosystem Hub</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white">AI & SaaS Platform Projects</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {activeProjects.map((proj, idx) => (
              <motion.div
                key={proj.name}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="relative group p-6 rounded-xl border border-zinc-900 bg-zinc-950/30 hover:border-orange-500/30 transition-all duration-300 overflow-hidden"
              >
                {/* Visual Glow Backdrop */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-white">{proj.name}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400">
                    {proj.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed relative z-10">{proj.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
