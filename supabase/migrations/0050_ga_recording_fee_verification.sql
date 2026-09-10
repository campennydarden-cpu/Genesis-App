-- supabase/migrations/0050_ga_recording_fee_verification.sql
-- Resolves 2 of the `verified=false` items 0049 flagged for Georgia, using a live quote
-- run against First American's public Comprehensive Calculator (facc.firstam.com) for
-- Fulton County, GA ($300,000 sale / $250,000 loan, non-refinance, term >= 62 months):
--   Conveyance Deed - Recording Fee: $25.00        (matches 0049's seeded flat fee)
--   Conveyance Deed - State Transfer Tax: $300.00  (matches 0049's $1 first-$1,000 + $0.10/$100 formula exactly)
--   Mortgage (DOT) - Recording Fee: $25.00         (matches 0049's seeded flat fee)
--   Mortgage (DOT) - Intangible Tax: $750.00       (matches 0049's $1.50/$500 formula exactly)
--   Power of Attorney - Recording Fee: $25.00      (0049 had left this null/unverified)
-- No separate Fulton-specific surcharge line appeared anywhere in the quote, which
-- disconfirms the single-secondary-source "$2/instrument Fulton surcharge" claim 0049
-- flagged but did not apply.

update public.recording_fee_schedules
set base_fee = 25.00,
    verified = true,
    notes = 'Confirmed via a live First American FACC quote (Fulton County, GA, 9/2026): $25.00 flat, same as the general HB 288 instrument rate.',
    source_url = 'https://facc.firstam.com'
where state = 'GA' and document_type = 'Power of Attorney';

update public.recording_fee_schedules
set notes = notes || ' Cross-checked via a live First American FACC quote (Fulton County, GA, 9/2026): $25.00 confirmed, no separate Fulton surcharge line item appeared -- disconfirms the single-secondary-source Fulton surcharge claim.'
where state = 'GA' and document_type = 'Deed';

update public.transfer_tax_schedules
set notes = notes || ' Cross-checked via a live First American FACC quote: on $300,000 consideration the formula produces $300.00 exactly, matching FACC''s own calculated Conveyance Deed - State Transfer Tax line.'
where state = 'GA' and label = 'Real Estate Transfer Tax';

update public.recordation_tax_schedules
set notes = notes || ' Cross-checked via a live First American FACC quote: on a $250,000 long-term (>=62 month) note, the formula produces $750.00 exactly, matching FACC''s own calculated Mortgage (DOT) - Intangible Tax line.'
where state = 'GA' and label = 'Intangible Recording Tax';
