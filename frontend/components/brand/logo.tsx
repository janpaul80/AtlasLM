import React from "react";

interface LogoProps {
  className?: string;
  size?: number; // width/height limit
  showText?: boolean; // kept for compatibility, ignored since logo.png has built-in text
  layout?: "horizontal" | "vertical";
}

export default function Logo({ 
  className = "", 
  size = 48, 
  layout = "horizontal"
}: LogoProps) {
  
  // Clean container scaling the original logo.png image dynamically
  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      <img
        src="/logo.png"
        alt="Atlas LM"
        className="object-contain transition-transform duration-300 hover:scale-105"
        style={{ 
          width: layout === "vertical"? size * 1.2: size, 
          height: "auto", 
          maxHeight: size 
        }}
      />
    </div>
  );
}
