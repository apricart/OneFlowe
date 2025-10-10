import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" fill="none" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" fill="none" />
    </svg>
  )
}

export function LoaderOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: "color-mix(in oklab, black, transparent 80%)" }}>
      <div className="rounded-xl p-6 bg-white shadow-lg grid place-items-center gap-3">
        <Spinner size={32} />
        <div className="text-sm">Loading…</div>
      </div>
    </div>
  )
}

export { Skeleton }
