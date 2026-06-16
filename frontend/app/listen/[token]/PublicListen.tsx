// frontend/app/listen/[token]/PublicListen.tsx
"use client";
import { useRef, useState } from "react";
import AtlasLogo from "@/app/components/brand/AtlasLogo";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function PublicListen(
  { data, apiBase, token }: { data: any; apiBase: string; token: string },
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const lines = data.transcript ?? [];
  const dur = data.duration ?? 0;
  const active = lines.reduce(
    (acc: number, l: any, i: number) => (pos >= (l.start ?? 0) ? i : acc), 0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  }

  return (
    <div className="ao-public">
      <div className="ao-root" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="ao-player">
          <div className="ao-now">
            <div className="ao-now-icon" aria-hidden>🎧</div>
            <div className="ao-now-meta">
              <div className="ao-now-title">{data.title}</div>
              <div className="ao-now-sub">Audio Overview · {fmt(dur)}</div>
            </div>
          </div>
          <audio ref={audioRef} src={`${apiBase}/public/audio/${token}/stream`}
            onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)} preload="metadata" />
          <div className="ao-progress">
            <div className="ao-progress-fill"
              style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} />
          </div>
          <div className="ao-times"><span>{fmt(pos)}</span><span>{fmt(dur)}</span></div>
          <div className="ao-controls">
            <button type="button" className="ao-play" onClick={toggle}>
              {playing ? "Pause" : "Play"}
            </button>
          </div>
        </div>

        <div className="ao-transcript" style={{ marginTop: 16 }}>
          {lines.map((l: any, i: number) => (
            <div key={i} className={`ao-line ${i === active && playing ? "is-active" : ""}`}>
              <span className={`ao-spk ao-spk-${l.speaker}`}>{l.name}</span>
              <p>{l.text}</p>
            </div>
          ))}
        </div>

        <a className="ao-credit" href="/">
          <AtlasLogo size={18} variant="mark" /> Made with Atlas LM
        </a>
      </div>
    </div>
  );
}
