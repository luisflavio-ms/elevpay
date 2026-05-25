import logoMark from "@/assets/logo-mark.png";
import logoFull from "@/assets/logo-full.png";

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logoMark}
      alt="ElevPay"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
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

export function LogoFull({ height = 32, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src={logoFull}
      alt="ElevPay"
      className={className}
      style={{ height, width: "auto", objectFit: "contain" }}
    />
  );
}
