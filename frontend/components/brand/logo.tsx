import React from "react";

interface LogoProps {
  className?: string;
  size?: number; // width and height multiplier
  showText?: boolean;
}

export default function Logo({ className = "", size = 48, showText = true }: LogoProps) {
  // Scales viewBox="0 0 1000 1000" based on size prop
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 1000 1000"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        {/* Stylized Left Mountain (Grey Outline Structure) */}
        <path
          d="M320 220L110 590H260L390 360L520 590H410L470 690H710L490 280L320 220Z"
          fill="#D4D4D8"
          stroke="#71717A"
          strokeWidth="10"
        />
        
        {/* Stylized Right Mountain (Grey Outline Structure) */}
        <path
          d="M680 390L490 690H890L730 420L680 390Z"
          fill="#A1A1AA"
          stroke="#52525B"
          strokeWidth="10"
        />
        
        {/* Accent Peak Triangle (Vibrant Solid Red-Orange) */}
        <path
          d="M680 540L550 760H810L680 540Z"
          fill="#FF3D00"
        />
      </svg>
      {showText && (
        <span className="font-sans font-extrabold tracking-tight text-white text-xl">
          Atlas<span className="text-orange-500 font-medium">LM</span>
        </span>
      )}
    </div>
  );
}
