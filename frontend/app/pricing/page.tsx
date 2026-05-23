"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "../../components/layout/header";
import Footer from "../../components/layout/footer";


export default function PricingPage() {
  const CheckIcon = () => (
    <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  const CrossIcon = () => (
    <svg className="w-4 h-4 text-zinc-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const tiers = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      desc: "For individuals beginning with source-grounded research.",
      features: [
        { text: "Up to 3 distinct workspaces", active: true },
        { text: "50MB total document storage", active: true },
        { text: "Local parsing & metadata tracking", active: true },
        { text: "Access to Ollama (local) model configurations", active: true },
        { text: "Priority GPT-4o & premium models", active: false },
        { text: "Collaborative shared workspaces", active: false },
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      desc: "For power researchers requiring maximum API performance and capacity.",
      features: [
        { text: "Unlimited active workspaces", active: true },
        { text: "1GB total document storage", active: true },
        { text: "Priority page-aware semantic RAG", active: true },
        { text: "Access to premium AI, Blackbox, & OpenRouter", active: true },
        { text: "Priority model speeds & concurrency", active: true },
        { text: "Shared workspace viewers", active: false },
      ],
      cta: "Upgrade to Pro",
      popular: true,
    },
    {
      name: "Teams",
      price: "$49",
      period: "per month",
      desc: "For collaborative intelligence workspaces and group research.",
      features: [
        { text: "Unlimited workspaces & document sizes", active: true },
        { text: "10GB shared document storage", active: true },
        { text: "Priority page-aware semantic RAG", active: true },
        { text: "Full provider integrations + Ollama host mapping", active: true },
        { text: "Group shared workspaces (multi-user sync)", active: true },
        { text: "Admin panel, audit logs, & billing controls", active: true },
      ],
      cta: "Launch Team Account",
      popular: false,
    },
  ];

  return (
    <div className="relative min-h-screen bg-zinc-950 flex flex-col justify-between overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 radial-glow pointer-events-none" />
      
      <Header />

      <main className="flex-grow pt-32 pb-24 px-6 max-w-7xl mx-auto relative z-10 w-full">
        {/* Title */}
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-500">Commercial Tiers</span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mt-2 mb-4">
            Transparent, builder pricing
          </h1>
          <p className="text-zinc-400 text-base max-w-lg mx-auto leading-relaxed">
            Choose the workspace scale that fits your research pipeline. Keep your data private under your own control.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {tiers.map((tier, idx) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`rounded-2xl p-8 relative flex flex-col justify-between border ${
                tier.popular
                  ? "bg-zinc-900/80 border-orange-500/40 shadow-xl shadow-orange-500/5 ring-1 ring-orange-500/20"
                  : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 transition-colors"
              }`}
            >
              {/* Popular tag */}
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-xs text-zinc-500 mb-6 leading-relaxed min-h-[40px]">{tier.desc}</p>
                
                {/* Price block */}
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-4xl md:text-5xl font-extrabold text-white">{tier.price}</span>
                  <span className="text-xs text-zinc-500 font-medium">/ {tier.period}</span>
                </div>

                <hr className="border-zinc-900/60 mb-8" />

                {/* Features */}
                <ul className="flex flex-col gap-4 mb-8">
                  {tier.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-xs leading-normal">
                      {feat.active ? <CheckIcon /> : <CrossIcon />}
                      <span className={feat.active ? "text-zinc-300" : "text-zinc-650"}>{feat.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <Link
                href="/dashboard"
                className={`w-full text-center py-3 rounded-lg font-bold text-xs transition-all duration-200 ${
                  tier.popular
                    ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850"
                }`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
