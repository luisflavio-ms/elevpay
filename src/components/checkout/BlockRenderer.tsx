import { useEffect, useState } from "react";
import type { CheckoutBlock } from "@/lib/types";
import guaranteeBadge from "@/assets/guarantee-badge.png";
import secureBadge from "@/assets/secure-badge.png";

interface Props {
  block: CheckoutBlock;
  color: string;
  asToast?: boolean;
  preview?: boolean;
}

export function BlockRenderer({ block, color, asToast, preview }: Props) {
  switch (block.type) {
    case "image":
      return block.src ? (
        <img
          src={block.src}
          alt={block.alt}
          loading="lazy"
          style={{
            width: "100%",
            display: "block",
            borderRadius: block.rounded ? 12 : 0,
          }}
        />
      ) : null;

    case "text": {
      const sizes = { sm: 12, md: 14, lg: 18, xl: 24 } as const;
      return (
        <div
          style={{
            fontSize: sizes[block.size],
            textAlign: block.align,
            fontWeight: block.bold ? 700 : 400,
            lineHeight: 1.45,
            color: "#0f172a",
            whiteSpace: "pre-wrap",
          }}
        >
          {block.content}
        </div>
      );
    }

    case "html":
      return <div dangerouslySetInnerHTML={{ __html: block.code }} />;

    case "timer":
      return <Timer minutes={block.minutes} label={block.label} color={color} />;

    case "guarantee":
      return (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 4px",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <img
            src={guaranteeBadge}
            alt="Selo de garantia"
            style={{ width: 88, height: 88, objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
              {block.title || `Garantia de ${block.days} dias`}
            </div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.4 }}>
              {block.text}
            </div>
          </div>
        </div>
      );

    case "notifications":
      return <Notifications block={block} color={color} asToast={asToast} preview={preview} />;

    case "secureSeal":
      return (
        <div
          style={{
            borderRadius: 12,
            padding: "14px 4px",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <img
            src={secureBadge}
            alt="Compra 100% segura"
            style={{ width: 88, height: 88, objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>Compra 100% segura</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4, lineHeight: 1.4 }}>{block.text}</div>
          </div>
        </div>
      );
  }
}

function Timer({ minutes, label, color }: { minutes: number; label: string; color: string }) {
  const [s, setS] = useState(minutes * 60);
  useEffect(() => {
    setS(minutes * 60);
  }, [minutes]);
  useEffect(() => {
    if (s <= 0) return;
    const t = setInterval(() => setS((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [s]);
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div
      style={{
        background: color, color: "#fff", borderRadius: 12,
        padding: "12px 14px", textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.9 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: 1 }}>
        {m}:{ss}
      </div>
    </div>
  );
}

function Notifications({
  block, color, asToast, preview,
}: { block: Extract<CheckoutBlock, { type: "notifications" }>; color: string; asToast?: boolean; preview?: boolean }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(preview ? true : false);
  const [started, setStarted] = useState(preview ? true : false);
  useEffect(() => {
    if (preview) return;
    if (block.items.length === 0) return;
    const delayMs = Math.max(0, block.delaySec ?? 6) * 1000;
    const intervalMs = Math.max(2, block.intervalSec) * 1000;
    const startTimer = setTimeout(() => {
      setStarted(true);
      setShow(true);
    }, delayMs);
    let interval: ReturnType<typeof setInterval> | undefined;
    const cycleTimer = setTimeout(() => {
      interval = setInterval(() => {
        setShow(false);
        setTimeout(() => {
          setI((v) => (v + 1) % block.items.length);
          setShow(true);
        }, 250);
      }, intervalMs);
    }, delayMs);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(cycleTimer);
      if (interval) clearInterval(interval);
    };
  }, [block.items.length, block.intervalSec, block.delaySec, preview]);

  if (block.items.length === 0) return null;
  if (!started) return null;
  const it = block.items[i];
  const card = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(4px)",
        transition: "opacity .25s, transform .25s",
        maxWidth: 320,
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: color, color: "#fff",
          display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14,
        }}
      >
        {it.name.charAt(0)}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.3 }}>
        <div><b>{it.name}</b> {it.product}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{it.city} • {it.ago}</div>
      </div>
    </div>
  );

  if (asToast) {
    return (
      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        {card}
      </div>
    );
  }
  return card;
}
