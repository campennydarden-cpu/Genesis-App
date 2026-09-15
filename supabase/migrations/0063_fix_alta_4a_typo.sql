-- supabase/migrations/0063_fix_alta_4a_typo.sql
-- ALTA Standard Requirement 4a (Deed)'s seeded body (migration 0061) reads
-- "...to recorded among the land records..." — missing "be" ("to be
-- recorded"), unlike its 4b sibling which has the correct wording. Flagged
-- by the final whole-branch review; Cam's call was to fix it. Content-only
-- UPDATE, not a schema change — migrations are append-only in this repo so
-- 0061 itself is left as originally applied.

update public.requirement_templates
set body = '{{deed.type}} from {{contact.seller_names}} to {{contact.buyer_names}}, to be recorded among the land records for {{property.county}} County, {{property.state}}.'
where label = 'ALTA Standard Requirement 4a (Deed)';
