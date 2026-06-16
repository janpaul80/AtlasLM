import React from "react";
import AtlasLogo from "../../app/components/brand/AtlasLogo";

interface LogoProps {
  className?: string;
  size?: number; // width/height limit
  showText?: boolean; // kept for compatibility
  layout?: "horizontal" | "vertical";
}

export default function Logo({ 
  className = "", 
  size = 48, 
  layout = "horizontal"
}: LogoProps) {
  return (
    <div className={`flex items-center justify-center select-none ${className}`}>
      <AtlasLogo size={size} variant={layout === "vertical" ? "mark" : "full"} />
    </div>
  );
}
