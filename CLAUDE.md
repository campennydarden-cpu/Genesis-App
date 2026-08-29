@AGENTS.md

## UI decisions are not Ponytail's to make

If the `ponytail` skill/plugin is active in this session, its minimalism ladder does not apply to UI component or styling choices on this project. `design-system/MASTER.md` and shadcn/ui (locked in as the component library — see `Genesis Rebuild - Design System.md` in the vault) are the standing decision for every screen. Do not substitute a bare native element or hand-rolled markup for an established shadcn component on the grounds that it's "fewer lines" or "the platform already has one" — that ladder is for code/logic minimalism (avoiding unnecessary dependencies, redundant helpers, over-built abstractions), not a license to re-litigate an already-approved design-system decision. Apply Ponytail's ladder to everything else (data logic, server actions, utility code) as normal.

## Standing security checklist

`Security Concerns.md` in the vault is a living checklist (access control, injection, key exposure, rate limits, PII protection, and more) that applies for the duration of this build, not a one-time audit. Check it before writing anything that touches auth, user input, RLS policies, or sensitive fields — a new migration or Server Action that lands without considering it isn't done.
