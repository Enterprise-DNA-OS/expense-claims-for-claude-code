-- Expense Claims for Claude Code: staff expense claims for an NZ or Australian business.
-- Money is integer cents. Every person belongs to one entity, and the entity sets the home
-- currency and the tax rules (NZ or AU). A claim is a person's report; its lines are the receipts.
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  name text not null check (length(trim(name)) > 0),
  country text not null check (country in ('NZ', 'AU')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gst_number text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  email text,
  entity_id uuid not null references entities(id),
  cost_centre text not null default 'General',
  manager_id uuid references people(id),
  -- The largest claim this person may approve. Null means they approve nothing.
  approval_limit_cents bigint check (approval_limit_cents is null or approval_limit_cents > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  name text not null,
  gl_account text not null,
  entertainment boolean not null default false,
  mileage boolean not null default false,
  gst_claimable boolean not null default true,
  -- Per person per day, in home currency. Null means no limit.
  daily_limit_cents bigint check (daily_limit_cents is null or daily_limit_cents > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  last4 text not null unique check (last4 ~ '^[0-9]{4}$'),
  person_id uuid not null references people(id),
  issuer text not null default 'Company card',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create sequence claim_no start 1001;

create table claims (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('EXP-' || nextval('claim_no')),
  person_id uuid not null references people(id),
  title text not null check (length(trim(title)) > 0),
  purpose text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'approved', 'rejected', 'exported')),
  submitted_on date,
  decided_by text,
  decided_on date,
  decision_note text,
  batch_id uuid,
  source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- One row per receipt or card transaction. amount_cents is what was paid, in the currency paid,
-- GST included. home_cents is that amount in the entity's currency, and gst_cents the GST in it.
create table claim_lines (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id),
  spent_on date not null,
  merchant text not null check (length(trim(merchant)) > 0),
  category_id uuid not null references categories(id),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(12, 6) not null default 1 check (fx_rate > 0),
  home_cents bigint not null check (home_cents > 0),
  gst_cents bigint not null default 0 check (gst_cents >= 0),
  paid_by text not null default 'personal' check (paid_by in ('personal', 'card')),
  card_txn_id uuid unique,
  -- receipt: where the image or PDF is kept. evidence: what kind of document it is.
  receipt text,
  evidence text not null default 'none' check (evidence in ('none', 'receipt', 'tax_invoice', 'tax_invoice_named')),
  supplier_gst_number text,
  receipt_declaration text,
  attendees text,
  attendee_count integer check (attendee_count is null or attendee_count > 0),
  km numeric(8, 1) check (km is null or km > 0),
  business_purpose text,
  project text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (gst_cents < home_cents)
);

create table card_transactions (
  id uuid primary key default gen_random_uuid(),
  external_ref text not null unique,
  card_id uuid not null references cards(id),
  txn_date date not null,
  merchant text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  source text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table claim_lines add constraint line_card_txn foreign key (card_txn_id) references card_transactions(id);

create table batches (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  entity_id uuid not null references entities(id),
  exported_on date not null default current_date,
  file text not null,
  claims integer not null,
  total_cents bigint not null,
  actor text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table claims add constraint claim_batch foreign key (batch_id) references batches(id);

create table policy (
  key text primary key,
  value bigint not null,
  note text
);

create table audit (
  id bigserial primary key,
  action text not null,
  record_id uuid,
  actor text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['entities','people','categories','cards','claims','claim_lines','card_transactions','batches'] loop
    execute format('create trigger touch before update on %I for each row execute function touch_updated()', t);
  end loop;
end $$;

create function protect_history() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create trigger immutable_audit before update or delete on audit for each row execute function protect_history();
create trigger immutable_batches before update or delete on batches for each row execute function protect_history();
create trigger immutable_card_txns before delete on card_transactions for each row execute function protect_history();

-- A line on an exported claim is in the accounts. It cannot change or go.
create function protect_exported_lines() returns trigger language plpgsql as $$
begin
  if exists (select 1 from claims where id = old.claim_id and status = 'exported') then
    raise exception 'Line is on an exported claim and is part of the accounts';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger exported_lines before update or delete on claim_lines for each row execute function protect_exported_lines();

insert into policy (key, value, note) values
  ('receipt_over_cents', 2500, 'A line above this needs a receipt or a signed declaration'),
  ('au_tax_invoice_over_cents', 8250, 'AU: a GST credit above this needs a tax invoice (GST included)'),
  ('au_tax_invoice_named_from_cents', 100000, 'AU: a tax invoice from this amount must show the buyer''s identity or ABN'),
  ('nz_tsi_over_cents', 20000, 'NZ: GST above this needs taxable supply information'),
  ('nz_tsi_named_over_cents', 100000, 'NZ: GST above this needs taxable supply information naming the buyer'),
  ('late_claim_days', 60, 'Spend older than this when submitted is a late claim'),
  ('approval_stale_days', 5, 'A submitted claim waiting longer than this needs chasing'),
  ('card_unmatched_days', 14, 'A card transaction older than this with no claim line needs chasing'),
  ('draft_stale_days', 21, 'A draft claim untouched this long needs a nudge'),
  ('mileage_rate_cents_NZ', 104, 'Company reimbursement rate per km for NZ staff. Set from the IRD kilometre rate you adopt.'),
  ('mileage_rate_cents_AU', 88, 'Company reimbursement rate per km for AU staff. Set from the ATO cents per km rate you adopt.')
on conflict do nothing;

-- Every line with its claim, person, entity and category.
create view line_work as
select l.*, c.ref, c.title, c.status as claim_status, c.submitted_on, c.decided_by, c.decided_on, c.person_id,
  p.code as person_code, p.name as person, p.cost_centre, e.id as entity_id, e.code as entity, e.country, e.currency as home_currency,
  cat.code as category, cat.name as category_name, cat.gl_account, cat.entertainment, cat.mileage, cat.daily_limit_cents
from claim_lines l
join claims c on c.id = l.claim_id
join people p on p.id = c.person_id
join entities e on e.id = p.entity_id
join categories cat on cat.id = l.category_id;

create view claim_totals as
select c.id, c.ref, c.title, c.status, c.person_id, p.code as person_code, p.name as person, p.cost_centre, e.code as entity, e.currency,
  m.name as approver, c.submitted_on, c.decided_by, c.decided_on, c.batch_id, c.source, c.created_at::date as created_on,
  count(l.id)::int as lines,
  coalesce(sum(l.home_cents), 0)::bigint as total_cents,
  coalesce(sum(l.gst_cents), 0)::bigint as gst_cents,
  coalesce(sum(l.home_cents) filter (where l.paid_by = 'personal'), 0)::bigint as reimburse_cents,
  (count(l.id) filter (where l.receipt is null and l.receipt_declaration is null
     and l.home_cents > (select value from policy where key = 'receipt_over_cents') and not exists (select 1 from categories k where k.id = l.category_id and k.mileage)))::int as missing_receipts,
  case when c.status = 'submitted' then current_date - c.submitted_on end as days_waiting
from claims c
join people p on p.id = c.person_id
join entities e on e.id = p.entity_id
left join people m on m.id = p.manager_id
left join claim_lines l on l.claim_id = c.id
group by c.id, p.code, p.name, p.cost_centre, e.code, e.currency, m.name;

-- Card transactions and whether a claim line accounts for them.
create view card_work as
select t.id, t.external_ref, t.txn_date, t.merchant, t.amount_cents, t.currency, k.last4, p.code as person_code, p.name as person,
  l.id as line_id, c.ref as claim_ref, current_date - t.txn_date as age_days
from card_transactions t
join cards k on k.id = t.card_id
join people p on p.id = k.person_id
left join claim_lines l on l.card_txn_id = t.id
left join claims c on c.id = l.claim_id;

-- The checks /compliance runs. docs/compliance.md cites the source for each rule.
create view compliance_findings as
with pol as (select key, value from policy), live as (select * from line_work where claim_status not in ('draft', 'rejected'))
select 'EX01' as rule, ref, person || ' / ' || merchant as subject,
  'no receipt or declaration for ' || home_currency || ' ' || to_char(home_cents / 100.0, 'FM999999990.00') as finding
from live where receipt is null and receipt_declaration is null and not mileage and home_cents > (select value from pol where key = 'receipt_over_cents')
union all
select 'EX02', ref, person || ' / ' || merchant,
  case when evidence = 'tax_invoice' then 'GST credit of AUD ' || to_char(gst_cents / 100.0, 'FM999990.00') || ' on a purchase of AUD 1,000 or more with a tax invoice that does not identify the business'
       else 'GST credit of AUD ' || to_char(gst_cents / 100.0, 'FM999990.00') || ' on a purchase over AUD 82.50 with no tax invoice' end
from live where country = 'AU' and gst_cents > 0 and (
  (home_cents > (select value from pol where key = 'au_tax_invoice_over_cents') and evidence not in ('tax_invoice', 'tax_invoice_named'))
  or (home_cents >= (select value from pol where key = 'au_tax_invoice_named_from_cents') and evidence = 'tax_invoice'))
union all
select 'EX03', ref, person || ' / ' || merchant,
  case when home_cents > (select value from pol where key = 'nz_tsi_named_over_cents') then 'GST claimed on a supply over NZD 1,000 without taxable supply information naming the business'
       else 'GST claimed on a supply over NZD 200 without taxable supply information' end
from live where country = 'NZ' and gst_cents > 0 and (
  (home_cents > (select value from pol where key = 'nz_tsi_named_over_cents') and evidence <> 'tax_invoice_named')
  or (home_cents > (select value from pol where key = 'nz_tsi_over_cents') and evidence not in ('tax_invoice', 'tax_invoice_named')))
union all
select 'EX04', ref, person || ' / ' || merchant,
  'entertainment without ' || concat_ws(' or ', case when coalesce(trim(attendees), '') = '' or attendee_count is null then 'attendees' end, case when coalesce(trim(business_purpose), '') = '' then 'a business purpose' end)
from live where entertainment and (coalesce(trim(attendees), '') = '' or attendee_count is null or coalesce(trim(business_purpose), '') = '')
union all
select 'EX05', t.ref, t.person,
  case when lower(t.decided_by) in (lower(t.person), lower(t.person_code)) then 'approved by the person who claimed it'
       when a.id is null then 'approved by ' || t.decided_by || ', who is not on file as an approver'
       else 'approved by ' || a.name || ' above their limit of ' || t.currency || ' ' || to_char(coalesce(a.approval_limit_cents, 0) / 100.0, 'FM999999990.00') end
from claim_totals t
left join people a on lower(a.name) = lower(t.decided_by) or lower(a.code) = lower(t.decided_by)
where t.status in ('approved', 'exported') and t.decided_by is not null and (
  lower(t.decided_by) in (lower(t.person), lower(t.person_code)) or a.id is null or a.approval_limit_cents is null or a.approval_limit_cents < t.total_cents)
union all
select 'EX06', a.ref || ' and ' || b.ref, a.person || ' / ' || a.merchant,
  'same person, date, merchant and amount claimed twice: ' || a.home_currency || ' ' || to_char(a.home_cents / 100.0, 'FM999999990.00') || ' on ' || a.spent_on
from live a join live b on a.person_id = b.person_id and a.spent_on = b.spent_on and a.home_cents = b.home_cents and lower(trim(a.merchant)) = lower(trim(b.merchant)) and a.id < b.id
union all
select 'EX07', l.ref, l.person || ' / ' || l.merchant,
  'claimed as paid personally, but card transaction ' || w.external_ref || ' matches it'
from live l join card_work w on w.person_code = l.person_code and w.txn_date = l.spent_on and w.amount_cents = l.amount_cents and w.currency = l.currency
where l.paid_by = 'personal'
union all
select 'EX08', ref, person || ' / ' || merchant,
  'spent ' || spent_on || ', submitted ' || submitted_on || ': ' || (submitted_on - spent_on) || ' days, over the ' || (select value from pol where key = 'late_claim_days') || ' day policy'
from live where submitted_on is not null and submitted_on - spent_on > (select value from pol where key = 'late_claim_days')
union all
select 'EX09', ref, person || ' / ' || merchant,
  km || ' km claimed at ' || round(home_cents / km) || ' cents a km, over the company rate of ' || (select value from pol where key = 'mileage_rate_cents_' || country)
from live where mileage and km is not null and home_cents > ceil(km * (select value from pol where key = 'mileage_rate_cents_' || country))
union all
select 'EX10', min(ref), person || ' / ' || category_name || ' on ' || spent_on,
  home_currency || ' ' || to_char(sum(home_cents) / 100.0, 'FM999999990.00') || ' in one day, over the limit of ' || to_char(max(daily_limit_cents) / 100.0, 'FM999999990.00')
from live where daily_limit_cents is not null
group by person_id, person, category_id, category_name, spent_on, home_currency
having sum(home_cents) > max(daily_limit_cents);
