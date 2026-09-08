-- supabase/migrations/0019_contacts_linked_contact.sql
-- Links two Buyer/Borrower (or two Seller) contacts on the same order when married,
-- per Cam's note. Symmetric: the app writes both sides together, so either row's
-- linked_contact_id points at the other.

alter table public.contacts
  add column linked_contact_id uuid references public.contacts(id) on delete set null;
