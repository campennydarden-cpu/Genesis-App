import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Status values that read as "still in motion" across Order/Title/Escrow status.
const PENDING_STATUSES = new Set([
  "In Progress",
  "Searching",
  "Exam",
  "Curative",
  "Hold",
  "Hold - Title Only",
  "Docs Out",
  "Balancing",
])

// Status values that read as "done" across Order/Title/Escrow status.
const CLEARED_STATUSES = new Set([
  "Completed",
  "Cleared for Policy",
  "Policy Issued",
  "Policy Remitted",
  "Closed",
])

function statusTone(status: string): "pending" | "cleared" | "neutral" {
  if (PENDING_STATUSES.has(status)) return "pending"
  if (CLEARED_STATUSES.has(status)) return "cleared"
  return "neutral"
}

/**
 * Colors a status value at a glance while still showing the label as text,
 * so the status isn't conveyed by color alone (WCAG 1.4.1).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const tone = statusTone(status)

  if (tone === "pending") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-status-pending/30 bg-status-pending/10 text-status-pending",
          className
        )}
      >
        {status}
      </Badge>
    )
  }

  if (tone === "cleared") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-status-cleared/30 bg-status-cleared/10 text-status-cleared",
          className
        )}
      >
        {status}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className={className}>
      {status}
    </Badge>
  )
}
