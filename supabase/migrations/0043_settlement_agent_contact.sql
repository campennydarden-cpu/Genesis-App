-- Place of Settlement needs to pull the Settlement Agent and their address from
-- Contacts (Cam's click-through notes). A nullable FK, same pattern as every other
-- Contact-picker field in this app (on delete set null so a deleted contact just
-- clears the link, no data loss elsewhere).
alter table settlement_options
  add column settlement_agent_contact_id uuid references contacts(id) on delete set null;
