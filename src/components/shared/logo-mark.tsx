import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt="Cometa mcCore"
      className={cn("size-7 shrink-0 object-contain", className)}
    />
  );
}
