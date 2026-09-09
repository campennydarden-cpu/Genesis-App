-- Section G (Initial Escrow Payment at Closing) rows have a Per Month / Months pair
-- that computes the Borrower-Paid at Closing amount — confirmed by Cam's click-through
-- notes ("Notice the Per Month and Months columns, this is what is used to calculate
-- the Borrower-Paid at Closing column"). Display-only computed help, like Section A's
-- points config — never auto-written into the real Borrower/Seller-Paid columns.
alter table cdf_page2_lines
  add column per_month numeric,
  add column months numeric;
