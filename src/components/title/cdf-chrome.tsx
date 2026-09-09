'use client'

import type { HTMLAttributes, ReactNode } from 'react'

// Ports the old prototype's "CD-recreation chrome" (Genesis Build Log, 2026-08-25 CDF
// recreation entry — dark section bars, numbered line rows, subtotal/total weight)
// into this rebuild's own Tailwind/shadcn theme tokens rather than reimporting the
// prototype's separate navy/slate palette and fonts. Structure only, no page-specific
// business logic here — each CDF page still owns its own field composition and column
// widths, this just supplies the repeated chrome pieces.

export function CdfWrap({ children }: { children: ReactNode }) {
  return <div className="mb-5 overflow-hidden rounded-lg border bg-card">{children}</div>
}

export function CdfBar({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="bg-primary px-3.5 py-2 text-[13px] font-bold tracking-wide text-primary-foreground">
      {title}
      {sub && <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-primary-foreground/70">{sub}</span>}
    </div>
  )
}

export function CdfTable({ children }: { children: ReactNode }) {
  return <div className="px-3.5 pt-1 pb-3.5">{children}</div>
}

type CdfRowVariant = 'header' | 'section' | 'subtotal' | 'total'

const VARIANT_CLASSES: Record<CdfRowVariant, string> = {
  header: 'pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground',
  section: '-mx-3.5 mt-2.5 bg-muted px-3.5 py-1.5 text-[12px] font-bold text-foreground first:mt-0',
  subtotal: 'mt-0.5 border-t-[1.5px] border-primary font-semibold',
  total: 'border-t-2 border-primary text-[13px] font-bold',
}

export function CdfRow({
  variant,
  className = '',
  children,
  ...rest
}: {
  variant?: CdfRowVariant
  className?: string
  children: ReactNode
} & HTMLAttributes<HTMLDivElement>) {
  const noTopBorder = variant === 'header' || variant === 'section'
  return (
    <div
      className={`items-center gap-2 py-1.5 ${noTopBorder ? '' : 'border-t border-border first:border-t-0'} ${
        variant ? VARIANT_CLASSES[variant] : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CdfNum({ children }: { children: ReactNode }) {
  return <div className="text-right font-mono text-[10.5px] text-muted-foreground">{children}</div>
}

export function CdfAmtStatic({ children }: { children: ReactNode }) {
  return <div className="whitespace-nowrap text-right font-mono text-[12.5px]">{children}</div>
}

export function CdfMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border py-1.5 first:border-t-0">
      <span className="shrink-0 text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export const cdfInputClass = 'h-7 px-1.5 text-[12.5px]'
export const cdfAmtInputClass = 'h-7 px-1.5 text-right font-mono text-[12.5px]'
export const cdfSelectClass = 'block h-7 w-full rounded border px-1.5 text-[12.5px]'
