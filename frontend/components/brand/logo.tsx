import React from "react";

interface LogoProps {
  className?: string;
  size?: number; // size of the icon
  showText?: boolean;
  layout?: "horizontal" | "vertical";
}

export default function Logo({ 
  className = "", 
  size = 48, 
  showText = true,
  layout = "horizontal"
}: LogoProps) {
  
  // Scales text size based on icon size
  const getTextSizeClass = () => {
    if (layout === "vertical") {
      if (size < 60) return "text-xl mt-3";
      if (size < 100) return "text-2xl mt-4";
      return "text-4xl mt-6";
    } else {
      if (size < 34) return "text-xl";
      if (size < 44) return "text-2xl";
      if (size < 52) return "text-3xl";
      return "text-4xl";
    }
  };

  const getGapClass = () => {
    if (layout === "vertical") return "flex-col items-center text-center";
    if (size < 38) return "flex-row items-center gap-3";
    return "flex-row items-center gap-4";
  };

  return (
    <div className={`flex select-none ${getGapClass()} ${className}`}>
      <svg
        width={size}
        height={size * (560 / 800)} // Maintain correct cropped aspect ratio
        viewBox="100 210 800 560"
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
        layout === "vertical" ? (
          /* Vertical Stacked Logo Text - Matches the uploaded design 100% exactly */
          <span 
            className={`font-sans font-bold tracking-wider text-zinc-300/90 uppercase ${getTextSizeClass()}`}
            style={{ letterSpacing: "0.15em" }}
          >
            Atlas LM
          </span>
        ) : (
          /* Horizontal Inline Logo Text */
          <span className={`font-sans font-extrabold tracking-tight text-white ${getTextSizeClass()}`}>
            Atlas<span className="text-orange-500 font-medium">LM</span>
          </span>
        )
      )}
    </div>
  );
}
