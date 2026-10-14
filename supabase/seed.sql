-- Demo records for Tasman Engineering Consultants, an engineering firm with offices in New Zealand and Australia.
-- Every name is invented. Dates are relative to today so the attention lists always have something to say.
-- Deliberate problems: a claim waiting too long for approval, mileage above the company rate, a day over the meals
-- limit, missing receipts, an AU GST credit without a tax invoice, an NZ flight without the buyer named, client
-- entertainment with no attendees, a self-approved claim, a claim approved above the approver's limit, a taxi claimed
-- twice, a personal claim that matches a company card charge, a late claim, unmatched card charges and a stale draft.

insert into entities (id, code, name, country, currency, gst_number) values
  ('e0000000-0000-4000-8000-000000000001', 'TEC-NZ', 'Tasman Engineering Consultants Ltd', 'NZ', 'NZD', '123-456-789'),
  ('e0000000-0000-4000-8000-000000000002', 'TEC-AU', 'Tasman Engineering Consultants Pty Ltd', 'AU', 'AUD', '51 824 753 556')
on conflict do nothing;

insert into people (id, code, name, email, entity_id, cost_centre, manager_id, approval_limit_cents) values
  ('a0000000-0000-4000-8000-000000000001', 'MREID', 'Mere Reid', 'mere@tasman-eng.example', 'e0000000-0000-4000-8000-000000000001', 'Directors', null, 2000000),
  ('a0000000-0000-4000-8000-000000000002', 'JTAN', 'James Tan', 'james@tasman-eng.example', 'e0000000-0000-4000-8000-000000000001', 'Finance', 'a0000000-0000-4000-8000-000000000001', 500000),
  ('a0000000-0000-4000-8000-000000000003', 'ANGATA', 'Aroha Ngata', 'aroha@tasman-eng.example', 'e0000000-0000-4000-8000-000000000001', 'Structural', 'a0000000-0000-4000-8000-000000000001', 300000),
  ('a0000000-0000-4000-8000-000000000004', 'BWALSH', 'Ben Walsh', 'ben@tasman-eng.example', 'e0000000-0000-4000-8000-000000000001', 'Structural', 'a0000000-0000-4000-8000-000000000003', null),
  ('a0000000-0000-4000-8000-000000000005', 'PSINGH', 'Priya Singh', 'priya@tasman-eng.example', 'e0000000-0000-4000-8000-000000000001', 'Geotechnical', 'a0000000-0000-4000-8000-000000000003', null),
  ('a0000000-0000-4000-8000-000000000007', 'KCHEN', 'Kate Chen', 'kate@tasman-eng.example', 'e0000000-0000-4000-8000-000000000002', 'Sydney', 'a0000000-0000-4000-8000-000000000001', 300000),
  ('a0000000-0000-4000-8000-000000000006', 'LMORGAN', 'Liam Morgan', 'liam@tasman-eng.example', 'e0000000-0000-4000-8000-000000000002', 'Sydney', 'a0000000-0000-4000-8000-000000000007', null),
  ('a0000000-0000-4000-8000-000000000008', 'TFRASER', 'Tom Fraser', 'tom@tasman-eng.example', 'e0000000-0000-4000-8000-000000000002', 'Brisbane', 'a0000000-0000-4000-8000-000000000007', null)
on conflict do nothing;

insert into categories (id, code, name, gl_account, entertainment, mileage, gst_claimable, daily_limit_cents) values
  ('c1000000-0000-4000-8000-000000000001', 'MEALS', 'Meals while travelling', '6420', false, false, true, 8000),
  ('c1000000-0000-4000-8000-000000000002', 'ENT-CLIENT', 'Client entertainment', '6430', true, false, true, null),
  ('c1000000-0000-4000-8000-000000000003', 'ENT-STAFF', 'Staff entertainment', '6431', true, false, true, null),
  ('c1000000-0000-4000-8000-000000000004', 'AIR', 'Flights', '6410', false, false, true, null),
  ('c1000000-0000-4000-8000-000000000005', 'ACCOM', 'Accommodation', '6411', false, false, true, null),
  ('c1000000-0000-4000-8000-000000000006', 'TAXI', 'Taxis and rideshare', '6412', false, false, true, null),
  ('c1000000-0000-4000-8000-000000000007', 'PARKING', 'Parking and tolls', '6413', false, false, true, null),
  ('c1000000-0000-4000-8000-000000000008', 'MILEAGE', 'Private vehicle mileage', '6414', false, true, false, null),
  ('c1000000-0000-4000-8000-000000000009', 'SUPPLIES', 'Site supplies and PPE', '6510', false, false, true, null),
  ('c1000000-0000-4000-8000-000000000010', 'TRAINING', 'Training and conferences', '6610', false, false, true, null)
on conflict do nothing;

insert into cards (id, last4, person_id, issuer) values
  ('d0000000-0000-4000-8000-000000000001', '4417', 'a0000000-0000-4000-8000-000000000006', 'Company Visa'),
  ('d0000000-0000-4000-8000-000000000002', '5520', 'a0000000-0000-4000-8000-000000000007', 'Company Visa'),
  ('d0000000-0000-4000-8000-000000000003', '3391', 'a0000000-0000-4000-8000-000000000004', 'Company Mastercard')
on conflict do nothing;

insert into batches (id, ref, entity_id, exported_on, file, claims, total_cents, actor) values
  ('b0000000-0000-4000-8000-000000000001', 'TEC-NZ-0001', 'e0000000-0000-4000-8000-000000000001', current_date - 20, 'batches/TEC-NZ-0001.csv', 1, 89000, 'James Tan')
on conflict do nothing;

insert into claims (id, ref, person_id, title, purpose, status, submitted_on, decided_by, decided_on, decision_note, batch_id, source, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'EXP-0991', 'a0000000-0000-4000-8000-000000000004', 'Hamilton site visits', 'Te Rapa warehouse inspections', 'submitted', current_date - 12, null, null, null, null, 'manual', now() - interval '16 days'),
  ('f0000000-0000-4000-8000-000000000002', 'EXP-0992', 'a0000000-0000-4000-8000-000000000005', 'Christchurch geotech review', 'Lyttelton slope assessment for Port Hills client', 'approved', current_date - 6, 'Aroha Ngata', current_date - 3, 'Approved', null, 'manual', now() - interval '9 days'),
  ('f0000000-0000-4000-8000-000000000003', 'EXP-0993', 'a0000000-0000-4000-8000-000000000006', 'Sydney client workshop', 'Harbour Rail design workshop', 'submitted', current_date - 2, null, null, null, null, 'manual', now() - interval '5 days'),
  ('f0000000-0000-4000-8000-000000000004', 'EXP-0994', 'a0000000-0000-4000-8000-000000000008', 'Brisbane July travel', 'Logan bridge survey', 'submitted', current_date - 5, null, null, null, null, 'manual', now() - interval '6 days'),
  ('f0000000-0000-4000-8000-000000000005', 'EXP-0995', 'a0000000-0000-4000-8000-000000000004', 'Airport taxi', 'Hamilton site visits', 'approved', current_date - 10, 'Ben Walsh', current_date - 9, 'Approved in the old system', null, 'concur: history.csv', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-000000000006', 'EXP-0996', 'a0000000-0000-4000-8000-000000000003', 'Wellington structural conference', 'SESOC conference registration', 'exported', current_date - 30, 'James Tan', current_date - 28, 'Approved', 'b0000000-0000-4000-8000-000000000001', 'manual', now() - interval '32 days'),
  ('f0000000-0000-4000-8000-000000000007', 'EXP-0997', 'a0000000-0000-4000-8000-000000000007', 'Project close lunch', 'Harbour Rail stage one closeout', 'draft', null, null, null, null, null, 'manual', now() - interval '30 days'),
  ('f0000000-0000-4000-8000-000000000008', 'EXP-0998', 'a0000000-0000-4000-8000-000000000005', 'Site PPE', 'Boots and gloves for Lyttelton site', 'returned', current_date - 7, 'Aroha Ngata', current_date - 4, 'Receipt is unreadable, please upload it again', null, 'manual', now() - interval '8 days'),
  ('f0000000-0000-4000-8000-000000000009', 'EXP-0999', 'a0000000-0000-4000-8000-000000000008', 'Bridge inspection course', 'Engineers Australia bridge inspection course', 'approved', current_date - 8, 'Kate Chen', current_date - 6, 'Approved', null, 'manual', now() - interval '9 days')
on conflict do nothing;

insert into card_transactions (id, external_ref, card_id, txn_date, merchant, amount_cents, currency, source) values
  ('70000000-0000-4000-8000-000000000001', 'VISA-4417-0912', 'd0000000-0000-4000-8000-000000000001', current_date - 4, '13CABS SYDNEY', 6800, 'AUD', 'Demo card statement'),
  ('70000000-0000-4000-8000-000000000002', 'VISA-4417-0898', 'd0000000-0000-4000-8000-000000000001', current_date - 20, 'OFFICEWORKS NORTH SYDNEY', 15400, 'AUD', 'Demo card statement'),
  ('70000000-0000-4000-8000-000000000003', 'VISA-5520-0881', 'd0000000-0000-4000-8000-000000000002', current_date - 31, 'THE GROUNDS ALEXANDRIA', 36000, 'AUD', 'Demo card statement'),
  ('70000000-0000-4000-8000-000000000004', 'MC-3391-0920', 'd0000000-0000-4000-8000-000000000003', current_date - 3, 'Z ENERGY TE RAPA', 8900, 'NZD', 'Demo card statement'),
  ('70000000-0000-4000-8000-000000000005', 'MC-3391-0877', 'd0000000-0000-4000-8000-000000000003', current_date - 30, 'BUNNINGS HAMILTON', 21500, 'NZD', 'Demo card statement')
on conflict do nothing;

insert into claim_lines (id, claim_id, spent_on, merchant, category_id, amount_cents, currency, home_cents, gst_cents, paid_by, card_txn_id, receipt, evidence, supplier_gst_number, attendees, attendee_count, km, business_purpose, project) values
  -- EXP-0991, Ben Walsh: mileage over the rate on one trip, a meals day over the limit, parking with no receipt, and the taxi he also claimed on EXP-0995.
  ('10000000-0000-4000-8000-000000000101', 'f0000000-0000-4000-8000-000000000001', current_date - 16, 'Auckland to Te Rapa return', 'c1000000-0000-4000-8000-000000000008', 18720, 'NZD', 18720, 0, 'personal', null, null, 'none', null, null, null, 180, 'Site inspection, day one', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000102', 'f0000000-0000-4000-8000-000000000001', current_date - 14, 'Auckland to Te Rapa return', 'c1000000-0000-4000-8000-000000000008', 16800, 'NZD', 16800, 0, 'personal', null, null, 'none', null, null, null, 140, 'Site inspection, day two', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000103', 'f0000000-0000-4000-8000-000000000001', current_date - 15, 'Duck Island Cafe', 'c1000000-0000-4000-8000-000000000001', 2400, 'NZD', 2400, 313, 'personal', null, null, 'none', null, null, null, null, 'Lunch on site', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000104', 'f0000000-0000-4000-8000-000000000001', current_date - 14, 'Victoria Street Bistro', 'c1000000-0000-4000-8000-000000000001', 6500, 'NZD', 6500, 848, 'personal', null, 'receipts/0991-dinner.jpg', 'receipt', null, null, null, null, 'Dinner, overnight in Hamilton', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000105', 'f0000000-0000-4000-8000-000000000001', current_date - 14, 'Hayes Common', 'c1000000-0000-4000-8000-000000000001', 2900, 'NZD', 2900, 378, 'personal', null, 'receipts/0991-lunch.jpg', 'receipt', null, null, null, null, 'Lunch on site', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000106', 'f0000000-0000-4000-8000-000000000001', current_date - 16, 'Wilson Parking Hamilton', 'c1000000-0000-4000-8000-000000000007', 3800, 'NZD', 3800, 496, 'personal', null, null, 'none', null, null, null, null, 'Parking at the site office', 'TRP-204'),
  ('10000000-0000-4000-8000-000000000107', 'f0000000-0000-4000-8000-000000000001', current_date - 15, 'Auckland Co-op Taxis', 'c1000000-0000-4000-8000-000000000006', 6400, 'NZD', 6400, 835, 'personal', null, 'receipts/0991-taxi.jpg', 'receipt', null, null, null, null, 'Airport to office', 'TRP-204'),
  -- EXP-0992, Priya Singh: an approved trip with a flight over NZD 1,000 whose invoice does not name the firm, and client dinner with no attendees.
  ('10000000-0000-4000-8000-000000000201', 'f0000000-0000-4000-8000-000000000002', current_date - 13, 'Air New Zealand', 'c1000000-0000-4000-8000-000000000004', 145000, 'NZD', 145000, 18913, 'personal', null, 'receipts/0992-flight.pdf', 'tax_invoice', '063-062-361', null, null, null, 'Flights AKL to CHC return', 'LYT-118'),
  ('10000000-0000-4000-8000-000000000202', 'f0000000-0000-4000-8000-000000000002', current_date - 12, 'Novotel Christchurch', 'c1000000-0000-4000-8000-000000000005', 46000, 'NZD', 46000, 6000, 'personal', null, 'receipts/0992-hotel.pdf', 'tax_invoice', '052-374-195', null, null, null, 'Two nights', 'LYT-118'),
  ('10000000-0000-4000-8000-000000000203', 'f0000000-0000-4000-8000-000000000002', current_date - 12, 'Blue Star Taxis', 'c1000000-0000-4000-8000-000000000006', 4200, 'NZD', 4200, 548, 'personal', null, 'receipts/0992-taxi.jpg', 'receipt', null, null, null, null, 'Hotel to site', 'LYT-118'),
  ('10000000-0000-4000-8000-000000000204', 'f0000000-0000-4000-8000-000000000002', current_date - 12, 'Inati', 'c1000000-0000-4000-8000-000000000002', 31000, 'NZD', 31000, 4043, 'personal', null, 'receipts/0992-dinner.pdf', 'tax_invoice', '115-882-406', null, null, null, null, 'LYT-118'),
  -- EXP-0993, Liam Morgan: an AU hotel with a GST credit and only a receipt, and a taxi claimed personally that his company card paid.
  ('10000000-0000-4000-8000-000000000301', 'f0000000-0000-4000-8000-000000000003', current_date - 5, 'Vibe Hotel North Sydney', 'c1000000-0000-4000-8000-000000000005', 24000, 'AUD', 24000, 2182, 'personal', null, 'receipts/0993-hotel.jpg', 'receipt', null, null, null, null, 'Night before the workshop', 'HRL-031'),
  ('10000000-0000-4000-8000-000000000302', 'f0000000-0000-4000-8000-000000000003', current_date - 4, '13cabs', 'c1000000-0000-4000-8000-000000000006', 6800, 'AUD', 6800, 618, 'personal', null, 'receipts/0993-taxi.jpg', 'receipt', null, null, null, null, 'Hotel to Harbour Rail office', 'HRL-031'),
  ('10000000-0000-4000-8000-000000000303', 'f0000000-0000-4000-8000-000000000003', current_date - 4, 'Aria Restaurant', 'c1000000-0000-4000-8000-000000000002', 42000, 'AUD', 42000, 3818, 'personal', null, 'receipts/0993-dinner.pdf', 'tax_invoice', '61 102 694 410', 'Harbour Rail: D. Park, S. Ito. Tasman: Liam Morgan', 3, null, 'Workshop dinner with the client design team', 'HRL-031'),
  -- EXP-0994, Tom Fraser: submitted 95 days after the trip.
  ('10000000-0000-4000-8000-000000000401', 'f0000000-0000-4000-8000-000000000004', current_date - 100, 'Qantas', 'c1000000-0000-4000-8000-000000000004', 38900, 'AUD', 38900, 3536, 'personal', null, 'receipts/0994-flight.pdf', 'tax_invoice', '16 009 661 901', null, null, null, 'SYD to BNE return', 'LGN-077'),
  ('10000000-0000-4000-8000-000000000402', 'f0000000-0000-4000-8000-000000000004', current_date - 99, 'Felons Brewing Co', 'c1000000-0000-4000-8000-000000000001', 5400, 'AUD', 5400, 491, 'personal', null, 'receipts/0994-dinner.jpg', 'receipt', null, null, null, null, 'Dinner while travelling', 'LGN-077'),
  -- EXP-0995, Ben Walsh: approved by himself in the old system, and the same taxi as EXP-0991.
  ('10000000-0000-4000-8000-000000000501', 'f0000000-0000-4000-8000-000000000005', current_date - 15, 'Auckland Co-op Taxis', 'c1000000-0000-4000-8000-000000000006', 6400, 'NZD', 6400, 835, 'personal', null, 'receipts/0995-taxi.jpg', 'receipt', null, null, null, null, 'Airport to office', 'TRP-204'),
  -- EXP-0996, Aroha Ngata: exported last month.
  ('10000000-0000-4000-8000-000000000601', 'f0000000-0000-4000-8000-000000000006', current_date - 34, 'SESOC', 'c1000000-0000-4000-8000-000000000010', 89000, 'NZD', 89000, 11609, 'personal', null, 'receipts/0996-sesoc.pdf', 'tax_invoice_named', '098-551-302', null, null, null, 'Conference registration', null),
  -- EXP-0997, Kate Chen: a draft for a lunch her company card paid.
  ('10000000-0000-4000-8000-000000000701', 'f0000000-0000-4000-8000-000000000007', current_date - 31, 'The Grounds of Alexandria', 'c1000000-0000-4000-8000-000000000003', 36000, 'AUD', 36000, 3273, 'card', '70000000-0000-4000-8000-000000000003', 'receipts/0997-lunch.pdf', 'tax_invoice', '28 611 450 378', 'Sydney office team', 6, null, 'Stage one closeout lunch', 'HRL-031'),
  -- EXP-0998, Priya Singh: returned for a new receipt.
  ('10000000-0000-4000-8000-000000000801', 'f0000000-0000-4000-8000-000000000008', current_date - 9, 'Bunnings Christchurch', 'c1000000-0000-4000-8000-000000000009', 8900, 'NZD', 8900, 1161, 'personal', null, null, 'none', null, null, null, null, 'Boots and gloves', 'LYT-118'),
  -- EXP-0999, Tom Fraser: approved by Kate Chen, whose limit is AUD 3,000.
  ('10000000-0000-4000-8000-000000000901', 'f0000000-0000-4000-8000-000000000009', current_date - 10, 'Engineers Australia', 'c1000000-0000-4000-8000-000000000010', 412000, 'AUD', 412000, 37455, 'personal', null, 'receipts/0999-course.pdf', 'tax_invoice_named', '63 004 532 954', null, null, null, 'Bridge inspection course fee', null)
on conflict do nothing;
