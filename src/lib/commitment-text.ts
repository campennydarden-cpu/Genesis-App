import type { CommitmentRequirement } from '@/lib/types'

/**
 * Display-order pass: emit each top-level requirement immediately followed by its own
 * children, preserving original relative order within each group. computeReqLabels letters a
 * child off the last main number it emitted, so without this a sub-item stored after an
 * unrelated top-level item (rows come back in created_at order - there is no sort column)
 * gets lettered under the wrong parent. Display-only: does not change how rows are stored or
 * queried, so callers that just read/write rows need no changes.
 */
export function reorderForNumbering(requirements: CommitmentRequirement[]): CommitmentRequirement[] {
  const ids = new Set(requirements.map((r) => r.id))
  const topLevelIds = new Set(
    requirements.filter((r) => !r.parent_requirement_id || !ids.has(r.parent_requirement_id)).map((r) => r.id)
  )
  // Only pull up children of a top-level parent; anything deeper stays in place rather than
  // being dropped.
  const isChild = (r: CommitmentRequirement) => !!r.parent_requirement_id && topLevelIds.has(r.parent_requirement_id)

  const childrenOf = new Map<string, CommitmentRequirement[]>()
  for (const r of requirements) {
    if (!isChild(r)) continue
    const siblings = childrenOf.get(r.parent_requirement_id!)
    if (siblings) siblings.push(r)
    else childrenOf.set(r.parent_requirement_id!, [r])
  }

  return requirements.flatMap((r) => (isChild(r) ? [] : [r, ...(childrenOf.get(r.id) ?? [])]))
}

/** `startAt` is inclusive: the first top-level requirement renders as exactly `startAt`. */
export function computeReqLabels(requirements: CommitmentRequirement[], startAt: number): string[] {
  const ids = new Set(requirements.map((r) => r.id))
  let mainNum = (startAt || 1) - 1
  let childNum = 0
  return requirements.map((r) => {
    const hasParent = r.parent_requirement_id && ids.has(r.parent_requirement_id)
    if (!hasParent) {
      mainNum++
      childNum = 0
      return String(mainNum)
    }
    childNum++
    return String(mainNum) + String.fromCharCode(96 + childNum)
  })
}
