// npm test: a temporary database, migrate twice, seed twice, then every CLI command with assertions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, usage, cents, gstOf } from './expense.mjs';
import { parseCsv } from './lib/csv.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'expenses-smoke-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const db = await getDb();
const covered = new Set();
let checks = 0;
const check = (v, message) => { assert.ok(v, message); checks++; };
async function call(...args) { covered.add(args[0]); return run(db, args); }
async function fails(args, pattern) { covered.add(args[0]); await assert.rejects(() => run(db, args), pattern); checks++; }
const d = (await db.query("select current_date::text as today,(current_date-1)::text as yesterday,(current_date-3)::text as recent,(current_date+1)::text as tomorrow"))[0];
const rel = (f) => path.relative(REPO_ROOT, path.join(temp, f));

try {
  await migrate(db);
  check((await migrate(db)).ran.length === 0, 'migration repeat is a no-op');
  if (db.mode === 'postgres') await db.exec('truncate audit,claim_lines,claims,batches,card_transactions,cards,categories,people,entities cascade');
  await seed(db); await seed(db);
  check((await db.query('select count(*)::int n from claim_lines'))[0].n === 21, 'seed is idempotent');

  for (const cmd of Object.keys(reads)) check(Array.isArray(await call(cmd)), cmd + ' returns rows');
  check((await call('help')).length === Object.keys(usage).length, 'help lists every command');

  // The seeded problems show up where an owner would look.
  const rules = await call('compliance');
  for (const r of ['EX01', 'EX02', 'EX03', 'EX04', 'EX05', 'EX06', 'EX07', 'EX08', 'EX09', 'EX10']) check(rules.some((f) => f.rule === r), 'compliance finds ' + r);
  check(rules.filter((f) => f.rule === 'EX05').length === 2, 'self approval and over-limit approval');
  check(rules.find((f) => f.rule === 'EX02').finding.includes('AUD 21.82'), 'AU GST credit at risk, exact');
  check(rules.find((f) => f.rule === 'EX09').finding.includes('120 cents'), 'mileage over the rate');
  check(rules.find((f) => f.rule === 'EX10').finding.includes('94.00'), 'meals over the daily limit');
  const att = await call('attention');
  for (const w of ['waiting for approval', 'returned to claimant', 'approved, not yet batched', 'card charge with no claim', 'draft gone quiet']) check(att.some((r) => r.what === w), 'attention: ' + w);
  check(att.filter((r) => r.what === 'card charge with no claim').length === 2, 'only card charges past the window');
  check((await call('approvals'))[0].ref === 'EXP-0991', 'longest wait first');
  const ready = await call('export-ready');
  check(ready.find((r) => r.ref === 'EXP-0995').state.startsWith('blocked') && ready.find((r) => r.ref === 'EXP-0992').state === 'ready', 'export readiness');
  const gst = await call('gst');
  check(Number(gst.find((r) => r.entity === 'TEC-AU' && r.gst_at_risk_cents).gst_at_risk_cents) === 2182, 'GST at risk by entity');
  check((await call('entertainment')).length === 2, 'entertainment register');
  check((await call('duplicates')).length === 2, 'duplicates and card double claims');
  check((await call('card-unmatched')).length === 4, 'unmatched card charges');
  check((await call('claims')).length === 9, 'claims list');
  check((await call('claim', 'exp-0991')).lines.length === 7, 'claim detail');
  check((await call('claim', 'EXP-0991')).findings.some((f) => f.rule === 'EX06'), 'claim detail shows a shared finding');
  const aroha = await call('person', 'aroha');
  check(aroha.to_approve.length === 1 && aroha.to_approve[0].ref === 'EXP-0991', 'approver sees her queue');
  check((await call('person', 'BWALSH')).card_unmatched.length === 2, 'person card charges');
  const wr = await call('weekly-review');
  check(wr.approvals.length === 3 && wr.compliance.length > 10, 'weekly review');
  await fails(['person', 'a'], /Ambiguous person/);
  await fails(['claim', 'nothing-like-this'], /No matching claim/);

  // People and cards.
  await call('add-person', '--code=test1', '--name=Test <script> Person', '--entity=TEC-NZ', '--email=test@example.com', '--cost-centre=Structural', '--manager=Aroha Ngata', '--actor=Finance');
  await fails(['add-person', '--code=TEST1', '--name=Dup', '--entity=TEC-NZ', '--actor=F'], /unique|duplicate/);
  await fails(['add-person', '--code=X', '--name=X', '--entity=TEC-UK', '--actor=F'], /No entity/);
  await fails(['add-person', '--code=X', '--name=X', '--entity=TEC-NZ', '--email=nope', '--actor=F'], /Invalid email/);
  await fails(['add-person', '--code=X', '--name=X', '--entity=TEC-NZ'], /--actor is required/);
  await call('add-card', 'TEST1', '--last4=7788', '--actor=Finance');
  await fails(['add-card', 'TEST1', '--last4=77', '--actor=F'], /last four/);

  // A claim from draft to batch.
  const claim = await call('new-claim', 'TEST1', '--title=Napier site visit', '--purpose=Bridge abutment inspection', '--actor=Test');
  check(/^EXP-\d{4}$/.test(claim.ref) && claim.status === 'draft', 'new claim gets a reference');
  await fails(['submit', claim.ref, '--actor=Test'], /no lines/);
  const meal = await call('add-line', claim.ref, `--date=${d.recent}`, '--merchant=Mister D', '--category=meals', '--amount=46.00', '--actor=Test');
  check(Number(meal.gst_cents) === gstOf(4600, 'NZ') && Number(meal.gst_cents) === 600, 'NZ GST worked out at 3/23');
  const miles = await call('add-line', claim.ref, `--date=${d.recent}`, '--merchant=Hastings to Napier return', '--category=MILEAGE', '--km=42.5', '--actor=Test');
  check(Number(miles.home_cents) === 4420 && Number(miles.gst_cents) === 0, 'mileage at the company rate, no GST');
  const usd = await call('add-line', claim.ref, `--date=${d.recent}`, '--merchant=ASCE Library', '--category=TRAINING', '--amount=40.00', '--currency=USD', '--fx=1.72', '--receipt=receipts/asce.pdf', '--actor=Test');
  check(Number(usd.home_cents) === 6880 && Number(usd.gst_cents) === 0, 'foreign currency converted, no GST');
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=TRAINING', '--amount=1', '--currency=USD', '--actor=T'], /--fx is required/);
  await fails(['add-line', claim.ref, `--date=${d.tomorrow}`, '--merchant=X', '--category=MEALS', '--amount=1', '--actor=T'], /future/);
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=FUEL', '--amount=1', '--actor=T'], /No expense category/);
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=MILEAGE', '--actor=T'], /needs --km/);
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=MEALS', '--amount=12.345', '--actor=T'], /two decimals/);
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=MEALS', '--amount=10', '--gst=10', '--actor=T'], /less than the amount/);
  const dinner = await call('add-line', claim.ref, `--date=${d.recent}`, '--merchant=Pacifica', '--category=ENT-CLIENT', '--amount=380.00', '--evidence=tax_invoice', '--receipt=receipts/pacifica.pdf', '--actor=Test');
  await db.query("insert into card_transactions(external_ref,card_id,txn_date,merchant,amount_cents,currency,source) select 'TEST-CARD-1',id,current_date-3,'Z NAPIER',8450,'NZD','test' from cards where last4='7788'");
  const fuel = await call('add-line', claim.ref, `--date=${d.recent}`, '--merchant=Z Napier', '--category=PARKING', '--amount=84.50', '--card=TEST-CARD-1', '--receipt=receipts/z.jpg', '--actor=Test');
  check(fuel.paid_by === 'card', 'card line');
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=Z', '--category=PARKING', '--amount=84.50', '--card=TEST-CARD-1', '--actor=T'], /already on/);
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=Z', '--category=PARKING', '--amount=84.50', '--card=VISA-4417-0898', '--actor=T'], /Liam Morgan's card/);
  await assert.rejects(() => run(db, ['submit', claim.ref, '--actor=Test']), (e) => /Submit blocked: 2 line/.test(e.message) && e.candidates.length === 2); checks++;
  covered.add('submit');
  await call('receipt', meal.id.slice(0, 8), '--receipt=receipts/misterd.jpg', '--actor=Test');
  await fails(['receipt', dinner.id, '--receipt=x', '--declare=y', '--actor=T'], /not both/);
  await fails(['receipt', dinner.id, '--receipt=x', '--evidence=photo', '--actor=T'], /--evidence must be/);
  await fails(['submit', claim.ref, '--actor=Test'], /1 line/);
  await db.query("update claim_lines set attendees='Hawke''s Bay council: two engineers. Tasman: Test Person', attendee_count=3, business_purpose='Abutment repair scope' where id=$1", [dinner.id]);
  check((await call('submit', claim.ref, '--actor=Test')).status === 'submitted', 'submitted');
  await fails(['add-line', claim.ref, `--date=${d.recent}`, '--merchant=X', '--category=MEALS', '--amount=1', '--actor=T'], /only draft or returned/);
  await fails(['approve', claim.ref, '--actor=Test <script> Person'], /own claim/);
  await fails(['approve', claim.ref, '--actor=Somebody Else'], /not one person on file/);
  await fails(['approve', claim.ref, '--actor=Ben Walsh'], /approval limit is none/);
  await fails(['approve', claim.ref, '--actor=James Tan'], /not .*manager/);
  check((await call('approve', claim.ref, '--actor=James Tan', '--delegated=Aroha on leave')).decision_note.includes('Aroha on leave'), 'delegated approval');
  await fails(['approve', claim.ref, '--actor=Aroha Ngata'], /only submitted/);
  check((await call('return', claim.ref, '--reason=Add the project code', '--actor=James Tan')).status === 'returned', 'returned after approval');
  await call('submit', claim.ref, '--actor=Test');
  check((await call('approve', claim.ref, '--actor=ANGATA')).decided_by === 'Aroha Ngata', 'manager approves by code');

  // Batches: one bad approval holds the whole entity until it is fixed.
  await fails(['batch', 'TEC-NZ', `--file=${rel('batches/nz.csv')}`, '--actor=Finance'], /Batch blocked: 1 claim/);
  await call('return', 'EXP-0995', '--reason=Self-approved in the old system', '--actor=James Tan');
  await call('reject', 'EXP-0995', '--reason=Duplicate of EXP-0991', '--actor=James Tan');
  await fails(['reject', 'EXP-0995', '--reason=again', '--actor=J'], /is rejected/);
  const batch = await call('batch', 'TEC-NZ', `--file=${rel('batches/nz.csv')}`, '--actor=James Tan');
  check(batch.batch === 'TEC-NZ-0002' && batch.claims === 2 && batch.total_cents === 226200 + 4600 + 4420 + 6880 + 38000 + 8450, 'batch totals');
  check(batch.reimburse.find((r) => r.person.startsWith('Test')).reimburse_cents == 4600 + 4420 + 6880 + 38000, 'card spend is not reimbursed');
  const csv = parseCsv(fs.readFileSync(path.join(temp, 'batches/nz.csv'), 'utf8'));
  check(csv.length === 9 && csv.some((r) => r.merchant === 'Air New Zealand' && r.net === '1260.87' && r.gst === '189.13' && r.account === '6410'), 'accounting file lines');
  await fails(['batch', 'TEC-NZ', `--file=${rel('batches/nz2.csv')}`, '--actor=Finance'], /No approved claims/);
  await fails(['batch', 'TEC-NZ', `--file=${rel('batches/nz.csv')}`, '--actor=Finance'], /already exists/);
  await fails(['return', 'EXP-0992', '--reason=x', '--actor=J'], /only submitted or approved/);
  await assert.rejects(() => db.query("update claim_lines set home_cents=1 where claim_id=(select id from claims where ref='EXP-0992')"), /exported claim/); checks++;
  await assert.rejects(() => db.query('delete from batches'), /append-only/); checks++;
  await fails(['receipt', fuel.id, '--receipt=x', '--actor=T'], /receipts change only before approval/);

  // Card matching on a claim still in progress.
  const liam = await call('new-claim', 'LMORGAN', '--title=Office supplies', '--actor=Liam');
  const ow = await call('add-line', liam.ref, `--date=${d.recent}`, '--merchant=Officeworks', '--category=SUPPLIES', '--amount=154.00', '--evidence=tax_invoice', '--receipt=receipts/ow.pdf', '--actor=Liam');
  check(Number(ow.gst_cents) === 1400, 'AU GST worked out at 1/11');
  await fails(['match-card', 'VISA-4417-0912', ow.id, '--actor=Liam'], /do not match/);
  check((await call('match-card', 'VISA-4417-0898', ow.id, '--actor=Liam')).paid_by === 'card', 'match card');
  await fails(['match-card', 'VISA-4417-0898', ow.id, '--actor=Liam'], /already on/);
  await fails(['match-card', 'MC-3391-0877', ow.id, '--actor=Liam'], /not the claimant's/);
  await fails(['approve', 'EXP-0991', '--actor=Aroha Ngata'], /Approve blocked: 1 line/);
  await call('add-line', liam.ref, `--date=${d.recent}`, '--merchant=Hilton Sydney', '--category=ACCOM', '--amount=1200.00', '--evidence=tax_invoice', '--receipt=receipts/hilton.pdf', '--actor=Liam');
  await call('submit', liam.ref, '--actor=Liam');
  check((await call('compliance')).some((f) => f.rule === 'EX02' && f.ref === liam.ref && f.finding.includes('does not identify')), 'AU tax invoice of 1,000 or more must name the buyer');

  // Imports: a Concur expense export and a card statement.
  const imp = ['import', 'concur', '--file=examples/concur-expense-export.csv', '--map=examples/import-map.json', '--actor=Migration'];
  const before = (await db.query('select count(*)::int n from claim_lines'))[0].n;
  check((await call(...imp, '--dry-run')).lines_added === 5, 'dry run counts');
  check((await db.query('select count(*)::int n from claim_lines'))[0].n === before, 'dry run writes nothing');
  const first = await call(...imp);
  check(first.claims_added === 3 && first.lines_added === 5, 'concur import');
  check((await call(...imp)).reports_unchanged === 3, 'repeat import is idempotent');
  const hist = await call('claim', 'CONCUR-B77D20');
  check(hist.claim.status === 'exported' && hist.lines.some((l) => l.paid_by === 'card'), 'paid Concur reports land as history');
  check((await call('claim', 'CONCUR-C0921E')).claim.status === 'submitted', 'open Concur report lands as submitted');
  check(!(await call('export-ready')).some((r) => r.ref.startsWith('CONCUR-')), 'Concur history is never batched again');
  await fails(['import', 'concur', '--file=examples/concur-expense-export.csv', '--actor=M'], /Map these expense types.*Airfare/);
  const csvFile = path.join(temp, 'concur.csv');
  fs.writeFileSync(csvFile, 'Report ID,Employee ID,Transaction Date,Expense Type,Journal Amount\nZZ1,NOBODY,2026-09-01,TAXI,10.00\n');
  await fails(['import', 'concur', `--file=${csvFile}`, '--actor=M'], /Add these people first.*NOBODY/);
  fs.writeFileSync(csvFile, 'Report ID,Employee ID,Transaction Date,Expense Type,Journal Amount,Reimbursement Currency\nZZ2,BWALSH,2026-09-01,TAXI,10.00,AUD\n');
  await fails(['import', 'concur', `--file=${csvFile}`, '--actor=M'], /Row 2: amount is in AUD/);
  fs.writeFileSync(csvFile, 'Report ID,Employee ID,Transaction Date,Expense Type,Journal Amount\nZZ3,BWALSH,09/14/2026,TAXI,10.00\n');
  check((await call('import', 'concur', `--file=${csvFile}`, '--actor=M')).lines_added === 1, 'US dates read');
  await fails(['import', 'xero', `--file=${csvFile}`, '--actor=M'], /concur and cards/);
  const cards = ['import', 'cards', '--file=examples/card-statement.csv', '--actor=Finance'];
  const c1 = await call(...cards);
  check(c1.added === 3 && c1.credits_skipped === 1, 'card statement import');
  check((await call(...cards)).unchanged === 3, 'card import repeat');
  fs.writeFileSync(csvFile, 'Date,Card,Description,Amount,Reference\n2026-10-01,1111,Somewhere,5.00,R1\n');
  await fails(['import', 'cards', `--file=${csvFile}`, '--actor=F'], /no card ending 1111/);

  // Drafts, export, guards.
  const rem = await call('draft-reminder', 'LMORGAN', '--actor=Finance');
  const text = fs.readFileSync(rem.file, 'utf8');
  check(text.includes('13CABS SYDNEY') && text.includes('AUD 68.00') && text.startsWith('# DRAFT'), 'reminder lists card charges');
  check(rem.file !== (await call('draft-reminder', 'LMORGAN', '--actor=Finance')).file, 'drafts never overwrite');
  await fails(['draft-reminder', 'MREID', '--actor=F'], /Nothing to remind/);
  const rev = await call('draft-review', '--actor=Finance');
  check(fs.readFileSync(rev.file, 'utf8').includes('Weekly expenses review'), 'review draft');
  const ex = await call('export', `--file=${path.join(temp, 'backup.json')}`);
  check(JSON.parse(fs.readFileSync(ex.file, 'utf8')).claims.length === 15, 'export holds every claim');
  await fails(['export', `--file=${ex.file}`], /EEXIST/);
  await fails(['claims', '--json=yes'], /flag without a value/);
  await fails(['claims', '--oops'], /Unknown option/);
  await fails(['not-a-command'], /Unknown command/);
  await assert.rejects(() => db.query("update audit set actor='x'"), /append-only/); checks++;
  await assert.rejects(() => db.query('delete from card_transactions'), /append-only/); checks++;
  check((await call('history')).some((r) => r.action === 'batch'), 'audit trail');
  assert.throws(() => cents('0')); assert.throws(() => cents('1e3')); assert.equal(cents('0.01'), 1); assert.equal(gstOf(11000, 'AU'), 1000); checks += 4;
  check(parseCsv('﻿a,b\r\n"x,1","2"\r\n')[0].a === 'x,1', 'quoted CSV');

  await db.close();
  for (const script of ['view', 'docs']) {
    const p = spawnSync(process.execPath, ['scripts/' + script + '.mjs'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    check(p.status === 0, script + ': ' + p.stderr);
  }
  const html = fs.readdirSync(path.join(temp, 'views')).map((f) => fs.readFileSync(path.join(temp, 'views', f), 'utf8')).join('');
  check(html.includes('Test &lt;script&gt;') && !html.includes('Test <script>'), 'HTML escapes record text');
  check(fs.readdirSync(path.join(temp, 'docs-out')).length === 3, 'three documents rendered');
  const cli = spawnSync(process.execPath, ['scripts/expense.mjs', 'claims', '--json'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  check(cli.status === 0 && Array.isArray(JSON.parse(cli.stdout)), 'CLI JSON');
  const amb = spawnSync(process.execPath, ['scripts/expense.mjs', 'person', 'a', '--json'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  check(amb.status === 1 && JSON.parse(amb.stderr).candidates.length > 1, 'ambiguous name lists candidates and exits 1');
  for (const command of Object.keys(usage)) check(covered.has(command), 'not exercised: ' + command);
  console.log(`PASS: ${checks} checks; ${Object.keys(usage).length} CLI commands; ${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'PGlite'}`);
} finally {
  try { await db.close(); } catch {}
  fs.rmSync(temp, { recursive: true, force: true });
}
