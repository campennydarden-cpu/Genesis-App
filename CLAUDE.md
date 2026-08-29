@AGENTS.md

## UI decisions are not Ponytail's to make

If the `ponytail` skill/plugin is active in this session, its minimalism ladder does not apply to UI component or styling choices on this project. `design-system/MASTER.md` and shadcn/ui (locked in as the component library — see `Genesis Rebuild - Design System.md` in the vault) are the standing decision for every screen. Do not substitute a bare native element or hand-rolled markup for an established shadcn component on the grounds that it's "fewer lines" or "the platform already has one" — that ladder is for code/logic minimalism (avoiding unnecessary dependencies, redundant helpers, over-built abstractions), not a license to re-litigate an already-approved design-system decision. Apply Ponytail's ladder to everything else (data logic, server actions, utility code) as normal.
