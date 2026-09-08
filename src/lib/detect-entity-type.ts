import type { EntityType } from '@/lib/derivation-clause'

// Guesses entity type from a Grantor/Grantee name so the Derivation form
// never has to show an Entity Type picker — order matters, most distinctive
// pattern first. Falls back to 'Individual', the most common case.
export function detectEntityType(name: string): EntityType {
  if (/\btrust\b|\btrustees?\b/i.test(name)) return 'Trust'
  if (/\bp\.?l\.?l\.?c\.?\b|\bl\.?l\.?c\.?\b/i.test(name)) return 'LLC'
  if (/\bl\.?l\.?p\.?\b|\bl\.?p\.?\b|\bpartnership\b/i.test(name)) return 'Partnership'
  if (/\binc(orporated)?\.?\b|\bcorp(oration)?\.?\b|\bp\.?c\.?\b|\bp\.?a\.?\b/i.test(name)) return 'Corporation'
  if (/\bestate\b/i.test(name)) return 'Estate'
  return 'Individual'
}
