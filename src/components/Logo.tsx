export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="elev-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.58 0.24 295)" />
          <stop offset="100%" stopColor="oklch(0.68 0.22 300)" />
        </linearGradient>
      </defs>
      <path
        d="M14 8 L40 8 L40 18 L24 18 L34 24 L8 24 Z"
        fill="url(#elev-mark)"
      />
      <path
        d="M8 24 L34 24 L24 30 L40 30 L40 40 L14 40 Z"
        fill="url(#elev-mark)"
        opacity="0.85"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-wordmark text-xl ${className}`}>
      Elev<span className="accent">Pay</span>
    </span>
  );
}

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}
