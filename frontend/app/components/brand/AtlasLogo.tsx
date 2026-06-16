// frontend/app/components/brand/AtlasLogo.tsx
// Renders the real Atlas LM logo asset shipped in /public. Never recreate the
// mark in code; this points at the brand files.
import Image from "next/image";

type Props = { size?: number; variant?: "mark" | "full"; className?: string };

export default function AtlasLogo({ size = 28, variant = "mark", className }: Props) {
  const src = variant === "full" ? "/atlas-logo.png" : "/atlas-mark.png";
  const w = variant === "full" ? Math.round(size * 2.4) : size;
  return <Image src={src} alt="Atlas LM" width={w} height={size} className={className} priority />;
}
