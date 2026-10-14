#!/usr/bin/env node
// The one CLI for expense claims. Human tables by default, --json for machines.
//   npm run expense -- help
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, yesNo } from './lib/csv.mjs';

const pol = (k) => `(select value from policy where key='${k}')`;
const LIVE = "claim_status not in ('draft','rejected')";

export const reads = {
  people: "select p.code,p.name,e.code as entity,p.cost_centre,m.name as manager,p.approval_limit_cents,e.currency,p.email,(select string_agg(k.last4,',' order by k.last4) from cards k where k.person_id=p.id) as cards from people p join entities e on e.id=p.entity_id left join people m on m.id=p.manager_id where p.active order by e.code,p.cost_centre,p.name",
  categories: 'select code,name,gl_account,entertainment,mileage,gst_claimable,daily_limit_cents from categories order by code',
  claims: "select ref,person,entity,status,title,lines,currency,total_cents,reimburse_cents,submitted_on,decided_by from claim_totals order by array_position(array['returned','submitted','approved','draft','exported','rejected'],status),ref",
  approvals: "select t.ref,t.person,t.approver,t.submitted_on,t.days_waiting,t.currency,t.total_cents,t.missing_receipts,(select count(*) from compliance_findings f where f.ref like '%'||t.ref||'%')::int as findings from claim_totals t where t.status='submitted' order by t.days_waiting desc,t.ref",
  'card-unmatched': 'select external_ref,txn_date,person,last4,merchant,currency,amount_cents,age_days from card_work where line_id is null order by txn_date,person',
  'export-ready': "select t.ref,t.person,t.entity,t.currency,t.total_cents,t.reimburse_cents,t.decided_by,t.decided_on,case when exists (select 1 from compliance_findings f where f.rule='EX05' and f.ref=t.ref) then 'blocked: approval check EX05' else 'ready' end as state from claim_totals t where t.status='approved' and t.batch_id is null order by t.entity,t.ref",
  spend: `select to_char(spent_on,'YYYY-MM') as month,entity,home_currency as currency,cost_centre,category_name as category,count(*)::int as lines,sum(home_cents-gst_cents)::bigint as net_cents,sum(gst_cents)::bigint as gst_cents,sum(home_cents)::bigint as total_cents from line_work where ${LIVE} and spent_on>=(date_trunc('month',current_date)-interval '2 months')::date group by 1,2,3,4,5 order by 1 desc,2,4,9 desc`,
  gst: `select entity,home_currency as currency,to_char(spent_on,'YYYY-MM') as month,count(*) filter (where gst_cents>0)::int as lines,sum(gst_cents) filter (where not at_risk)::bigint as gst_supported_cents,sum(gst_cents) filter (where at_risk)::bigint as gst_at_risk_cents from (select *,
      case when country='AU' then gst_cents>0 and ((home_cents>${pol('au_tax_invoice_over_cents')} and evidence not in ('tax_invoice','tax_invoice_named')) or (home_cents>=${pol('au_tax_invoice_named_from_cents')} and evidence='tax_invoice'))
           else gst_cents>0 and ((home_cents>${pol('nz_tsi_named_over_cents')} and evidence<>'tax_invoice_named') or (home_cents>${pol('nz_tsi_over_cents')} and evidence not in ('tax_invoice','tax_invoice_named'))) end
      or (gst_cents>0 and receipt is null) as at_risk
    from line_work where ${LIVE}) g group by 1,2,3 order by 1,3 desc`,
  entertainment: `select entity,to_char(make_date(extract(year from spent_on - interval '3 months')::int,4,1),'YYYY-MM-DD') as year_from,ref,person,spent_on,merchant,category_name as category,attendee_count,attendees,business_purpose,home_currency as currency,home_cents as total_cents,gst_cents from line_work where entertainment and ${LIVE} order by entity,spent_on`,
  duplicates: "select rule,ref,subject,finding from compliance_findings where rule in ('EX06','EX07') order by rule,ref",
  batches: 'select b.ref,e.code as entity,b.exported_on,b.claims,e.currency,b.total_cents,b.file,b.actor from batches b join entities e on e.id=b.entity_id order by b.exported_on desc,b.ref',
  attention: `select what,item,detail from (
    select 1 as ord,'waiting for approval' as what,ref as item,person||', '||days_waiting||' days with '||coalesce(approver,'no approver on file') as detail from claim_totals where status='submitted' and days_waiting>${pol('approval_stale_days')}
    union all select 2,'returned to claimant',t.ref,t.person||': '||coalesce(c.decision_note,'') from claim_totals t join claims c using (id) where t.status='returned'
    union all select 3,'approved, not yet batched',ref,person||', '||currency||' '||to_char(total_cents/100.0,'FM999999990.00')||' approved '||decided_on from claim_totals where status='approved' and batch_id is null
    union all select 4,'card charge with no claim',external_ref,person||', '||merchant||' '||currency||' '||to_char(amount_cents/100.0,'FM999999990.00')||', '||age_days||' days old' from card_work where line_id is null and age_days>${pol('card_unmatched_days')}
    union all select 5,'draft gone quiet',ref,person||', started '||created_on||' and never submitted' from claim_totals where status='draft' and created_on<current_date-${pol('draft_stale_days')}::int
    union all select 6,'check '||rule,ref,subject||': '||finding from compliance_findings
  ) a order by ord,item`,
  compliance: 'select rule,ref,subject,finding from compliance_findings order by rule,ref',
  history: 'select action,record_id,actor,detail,created_at from audit order by created_at,id',
  policy: 'select key,value,note from policy order by key',
};

export const usage = {
  ...Object.fromEntries(Object.keys(reads).map((k) => [k, k])),
  claim: 'claim <ref>',
  person: 'person <code-or-name>',
  'weekly-review': 'weekly-review',
  'add-person': 'add-person --code= --name= --entity= [--email=] [--cost-centre=] [--manager=] [--limit=] --actor=',
  'add-card': 'add-card <person> --last4= [--issuer=] --actor=',
  'new-claim': 'new-claim <person> --title= [--purpose=] --actor=',
  'add-line': 'add-line <claim> --date=YYYY-MM-DD --merchant= --category= [--amount=] [--currency=] [--fx=] [--gst=] [--km=] [--card=<ref>] [--receipt=] [--evidence=receipt|tax_invoice|tax_invoice_named] [--supplier-gst=] [--attendees=] [--count=] [--purpose=] [--project=] --actor=',
  receipt: 'receipt <line-id> (--receipt= [--evidence=] [--supplier-gst=] | --declare=<reason>) --actor=',
  submit: 'submit <claim> --actor=',
  approve: 'approve <claim> [--delegated=<reason>] --actor=',
  return: 'return <claim> --reason= --actor=',
  reject: 'reject <claim> --reason= --actor=',
  'match-card': 'match-card <card-ref> <line-id> --actor=',
  batch: 'batch <entity> --file=batches/<name>.csv --actor=',
  import: 'import concur --file= [--map=examples/import-map.json] [--dry-run] --actor=  |  import cards --file= [--dry-run] --actor=',
  export: 'export --file=exports/backup.json',
  'draft-reminder': 'draft-reminder <person> --actor=',
  'draft-review': 'draft-review --actor=',
};

const allowed = {
  'add-person': ['code', 'name', 'entity', 'email', 'cost-centre', 'manager', 'limit'], 'add-card': ['last4', 'issuer'],
  'new-claim': ['title', 'purpose'],
  'add-line': ['date', 'merchant', 'category', 'amount', 'currency', 'fx', 'gst', 'km', 'card', 'receipt', 'evidence', 'supplier-gst', 'attendees', 'count', 'purpose', 'project'],
  receipt: ['receipt', 'evidence', 'supplier-gst', 'declare'], submit: [], approve: ['delegated'], return: ['reason'], reject: ['reason'],
  'match-card': [], batch: ['file'], import: ['file', 'map', 'dry-run'], export: ['file'], 'draft-reminder': [], 'draft-review': [],
};
const positional = {
  claim: 1, person: 1, 'add-card': 1, 'new-claim': 1, 'add-line': 1, receipt: 1, submit: 1, approve: 1, return: 1, reject: 1,
  'match-card': 2, batch: 1, import: 1, 'draft-reminder': 1,
};
const BOOLEAN = ['json', 'dry-run'];

export function parse(args) {
  const opts = {}, pos = [];
  for (const a of args) {
    if (a.startsWith('--')) {
      const i = a.indexOf('=');
      const k = a.slice(2, i < 0 ? undefined : i);
      if (k in opts) throw Error(`Repeated --${k}`);
      opts[k] = i < 0 ? true : a.slice(i + 1);
    } else pos.push(a);
  }
  return { opts, pos };
}
const required = (o, k) => { const v = o[k]; if (typeof v !== 'string' || !v.trim()) throw Error(`--${k} is required`); return v.trim(); };
const optional = (o, k) => (o[k] === undefined ? null : required(o, k));
export function cents(v) {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error('Money must be a positive decimal with at most two decimals, no currency symbols or separators');
  const [a, b = ''] = s.split('.');
  const n = Number(a) * 100 + Number(b.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n <= 0 || n > 10000000000) throw Error('Amount must be above zero and below 100,000,000');
  return n;
}
export function gstOf(homeCents, country) { return country === 'AU' ? Math.round(homeCents / 11) : Math.round((homeCents * 3) / 23); }
function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error('Use a valid YYYY-MM-DD date');
  return v;
}
function int(v, name, min = 1) {
  if (!/^\d+$/.test(String(v)) || Number(v) < min) throw Error(`--${name} must be a whole number of at least ${min}`);
  return Number(v);
}
function currency(v) { if (!/^[A-Z]{3}$/.test(v)) throw Error('Currency must be three uppercase letters'); return v; }
const EVIDENCE = ['receipt', 'tax_invoice', 'tax_invoice_named'];
function evidence(v) { if (!EVIDENCE.includes(v)) throw Error(`--evidence must be one of ${EVIDENCE.join(', ')}`); return v; }
const tx = async (db, fn) => { await db.exec('BEGIN'); try { const r = await fn(); await db.exec('COMMIT'); return r; } catch (e) { await db.exec('ROLLBACK'); throw e; } };

// Exact id prefix or exact label first, then a case-insensitive contains match. More than one is an error with candidates.
async function resolve(db, sql, label, needle, what) {
  let rows = await db.query(`select * from (${sql}) r where r.id::text like $1 or lower(r.${label}::text)=lower($2) order by r.${label}`, [needle.toLowerCase() + '%', needle]);
  if (!rows.length) rows = await db.query(`select * from (${sql}) r where position(lower($1) in lower(r.${label}::text))>0 order by r.${label}`, [needle]);
  if (rows.length !== 1) {
    const err = Error(rows.length ? `Ambiguous ${what}; use the full id or code` : `No matching ${what}: ${needle}`);
    err.candidates = rows.map((r) => ({ id: r.id, [label]: r[label], ...(r.name && label !== 'name' ? { name: r.name } : {}) }));
    throw err;
  }
  return rows[0];
}
const personSql = 'select p.*,e.code as entity,e.country,e.currency from people p join entities e on e.id=p.entity_id';
async function findPerson(db, n) {
  const byCode = await db.query(`select * from (${personSql}) p where lower(code)=lower($1)`, [n]);
  return byCode.length === 1 ? byCode[0] : resolve(db, personSql, 'name', n, 'person');
}
const claimSql = 'select c.*,p.name as person,p.code as person_code,p.manager_id,e.country,e.currency,e.code as entity from claims c join people p on p.id=c.person_id join entities e on e.id=p.entity_id';
async function findClaim(db, n) {
  const byRef = await db.query(`select * from (${claimSql}) c where lower(ref)=lower($1)`, [n]);
  return byRef.length === 1 ? byRef[0] : resolve(db, claimSql, 'title', n, 'claim');
}
async function findCategory(db, n) {
  const rows = await db.query('select * from categories where lower(code)=lower($1) or lower(name)=lower($1)', [n]);
  if (rows.length !== 1) { const e = Error(`No expense category ${n}`); e.candidates = await db.query('select id,code,name from categories order by code'); throw e; }
  return rows[0];
}
async function findEntity(db, n) {
  const rows = await db.query('select * from entities where lower(code)=lower($1)', [n]);
  if (rows.length !== 1) { const e = Error(`No entity with code ${n}`); e.candidates = await db.query('select id,code,name from entities order by code'); throw e; }
  return rows[0];
}
const findLine = (db, n) => resolve(db, 'select l.*,c.status as claim_status,c.person_id,c.ref from claim_lines l join claims c on c.id=l.claim_id', 'id', n, 'claim line');
const audit = (db, action, id, actor, detail) => db.query('insert into audit(action,record_id,actor,detail) values($1,$2,$3,$4)', [action, id, actor, JSON.stringify(detail)]);
const today = async (db) => (await db.query('select current_date::text as d'))[0].d;
const policy = async (db, key) => Number((await db.query('select value from policy where key=$1', [key]))[0].value);
const editable = (c) => { if (!['draft', 'returned'].includes(c.status)) throw Error(`Claim ${c.ref} is ${c.status}; only draft or returned claims change`); };

// What blocks a claim from moving on: receipts and entertainment records.
async function blockers(db, claimId) {
  const over = await policy(db, 'receipt_over_cents');
  return db.query(`select l.id,l.merchant,l.spent_on,l.home_cents,
      case when l.receipt is null and l.receipt_declaration is null and not k.mileage and l.home_cents>$2 then 'no receipt or declaration'
           when k.mileage and l.km is null then 'mileage with no km'
           else 'entertainment needs attendees, a head count and a business purpose' end as problem
    from claim_lines l join categories k on k.id=l.category_id where l.claim_id=$1 and (
      (l.receipt is null and l.receipt_declaration is null and not k.mileage and l.home_cents>$2)
      or (k.mileage and l.km is null)
      or (k.entertainment and (coalesce(trim(l.attendees),'')='' or l.attendee_count is null or coalesce(trim(l.business_purpose),'')=''))) order by l.spent_on`, [claimId, over]);
}

async function claimDetail(db, c) {
  return {
    claim: (await db.query('select ref,person,entity,status,title,lines,currency,total_cents,gst_cents,reimburse_cents,missing_receipts,approver,submitted_on,decided_by,decided_on,source from claim_totals where id=$1', [c.id]))[0],
    purpose: c.purpose, decision_note: c.decision_note,
    lines: await db.query('select id,spent_on,merchant,category,currency,amount_cents,home_cents,gst_cents,paid_by,evidence,receipt,km,attendee_count,project from line_work where claim_id=$1 order by spent_on,merchant', [c.id]),
    findings: await db.query("select rule,finding from compliance_findings where ref=$1 or ref like $1||' and %' or ref like '% and '||$1 order by rule", [c.ref]),
  };
}

async function review(db) {
  const out = {};
  for (const k of ['approvals', 'export-ready', 'card-unmatched', 'compliance']) out[k.replace(/-/g, '_')] = await db.query(reads[k]);
  out.spend_this_month = await db.query(`select entity,home_currency as currency,count(distinct claim_id)::int as claims,count(*)::int as lines,sum(home_cents)::bigint as total_cents,sum(gst_cents)::bigint as gst_cents from line_work where ${LIVE} and spent_on>=date_trunc('month',current_date)::date group by 1,2 order by 1`);
  return out;
}

function draftFile(name, content) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${randomUUID().slice(0, 8)}.md`);
  fs.writeFileSync(file, content, { flag: 'wx' });
  return file;
}
const dollars = (c, cur) => `${cur} ${(Number(c) / 100).toFixed(2)}`;
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };

export async function run(db, args) {
  const { opts: o, pos } = parse(args);
  const cmd = pos.shift() || 'help';
  if (cmd === 'help' || o.help) return Object.entries(usage).map(([command, syntax]) => ({ command, syntax }));
  if (!(cmd in usage)) throw Error(`Unknown command ${cmd}. Run help for the list.`);
  for (const f of BOOLEAN) if (f in o && o[f] !== true) throw Error(`--${f} is a flag without a value`);
  for (const k of Object.keys(o)) if (!['json', 'actor', ...(allowed[cmd] || [])].includes(k)) throw Error(`Unknown option --${k} for ${cmd}`);
  if (pos.length !== (positional[cmd] || 0)) throw Error(`Usage: ${usage[cmd]}`);

  if (cmd in reads) return db.query(reads[cmd]);
  if (cmd === 'claim') return claimDetail(db, await findClaim(db, pos[0]));
  if (cmd === 'person') {
    const p = await findPerson(db, pos[0]);
    return {
      person: (await db.query("select p.code,p.name,e.code as entity,p.cost_centre,m.name as manager,p.approval_limit_cents,p.email from people p join entities e on e.id=p.entity_id left join people m on m.id=p.manager_id where p.id=$1", [p.id]))[0],
      claims: await db.query('select ref,status,title,lines,currency,total_cents,missing_receipts,submitted_on,decided_by from claim_totals where person_id=$1 order by created_on desc', [p.id]),
      card_unmatched: await db.query('select external_ref,txn_date,merchant,currency,amount_cents,age_days from card_work where line_id is null and person_code=$1 order by txn_date', [p.code]),
      to_approve: await db.query("select t.ref,t.person,t.days_waiting,t.currency,t.total_cents from claim_totals t join people x on x.id=t.person_id where t.status='submitted' and x.manager_id=$1 order by t.days_waiting desc", [p.id]),
    };
  }
  if (cmd === 'weekly-review') return review(db);
  if (cmd === 'export') {
    const file = path.resolve(REPO_ROOT, required(o, 'file'));
    const data = await tx(db, async () => {
      const out = { version: 1, exported_at: new Date().toISOString() };
      for (const t of ['entities', 'people', 'categories', 'cards', 'claims', 'claim_lines', 'card_transactions', 'batches', 'policy', 'audit']) out[t] = await db.query(`select * from ${t} order by ${t === 'policy' ? 'key' : 'id'}`);
      return out;
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    return { file, records: Object.values(data).filter(Array.isArray).reduce((n, a) => n + a.length, 0) };
  }

  const actor = required(o, 'actor');
  if (cmd === 'import') {
    if (pos[0] === 'concur') return importConcur(db, o, actor);
    if (pos[0] === 'cards') return importCards(db, o, actor);
    throw Error('Import supports concur and cards');
  }
  if (cmd === 'draft-review') {
    const r = await review(db);
    return { file: draftFile('weekly-expenses-review', `# Weekly expenses review (draft)\n\nPrepared by ${actor} on ${await today(db)}. Internal. Nothing has been approved, paid or sent.\n\n${human(r)}\n\nAmounts are in each entity's home currency, GST included. Findings cite the rules in docs/compliance.md.\n`) };
  }
  if (cmd === 'draft-reminder') {
    const p = await findPerson(db, pos[0]);
    if (!p.email) throw Error(`Draft blocked: no email recorded for ${p.name}`);
    const cards = await db.query('select external_ref,txn_date,merchant,currency,amount_cents from card_work where line_id is null and person_code=$1 order by txn_date', [p.code]);
    const claims = await db.query("select t.ref,t.title,t.status,t.missing_receipts,c.decision_note from claim_totals t join claims c using (id) where t.person_id=$1 and (t.status in ('draft','returned') or (t.missing_receipts>0 and t.status<>'rejected' and t.status<>'exported')) order by t.ref", [p.id]);
    if (!cards.length && !claims.length) throw Error(`Nothing to remind ${p.name} about`);
    const cardRows = cards.map((c) => `| ${c.txn_date} | ${c.merchant} | ${dollars(c.amount_cents, c.currency)} |`).join('\n');
    const claimRows = claims.map((c) => `- ${c.ref} ${c.title}: ${c.status === 'returned' ? `returned: ${c.decision_note}` : c.status === 'draft' ? 'started, not submitted' : `${c.missing_receipts} receipt(s) missing`}`).join('\n');
    const file = draftFile(`reminder-${p.code.toLowerCase()}`, `# DRAFT: review before sending\n\nTo: ${p.email}\nSubject: Expenses to finish\n\nHi ${p.name.split(' ')[0]},\n\n${cards.length ? `These company card charges have no expense claim yet. Add each one to a claim with its receipt:\n\n| Date | Merchant | Amount |\n|---|---|---|\n${cardRows}\n\n` : ''}${claims.length ? `These claims need you:\n\n${claimRows}\n\n` : ''}Thanks.\n\n## Internal\nPrepared by ${actor}. Nothing has been sent.\n`);
    return { file, card_charges: cards.length, claims: claims.length };
  }

  return tx(db, async () => {
    let result, id;
    if (cmd === 'add-person') {
      const e = await findEntity(db, required(o, 'entity'));
      const email = optional(o, 'email');
      if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw Error('Invalid email');
      const manager = o.manager ? await findPerson(db, required(o, 'manager')) : null;
      result = (await db.query('insert into people(code,name,email,entity_id,cost_centre,manager_id,approval_limit_cents) values($1,$2,$3,$4,$5,$6,$7) returning *', [required(o, 'code').toUpperCase(), required(o, 'name'), email, e.id, optional(o, 'cost-centre') || 'General', manager?.id || null, o.limit ? cents(required(o, 'limit')) : null]))[0];
    } else if (cmd === 'add-card') {
      const p = await findPerson(db, pos[0]);
      const last4 = required(o, 'last4');
      if (!/^\d{4}$/.test(last4)) throw Error('--last4 is the last four digits of the card');
      result = (await db.query('insert into cards(last4,person_id,issuer) values($1,$2,$3) returning *', [last4, p.id, optional(o, 'issuer') || 'Company card']))[0];
    } else if (cmd === 'new-claim') {
      const p = await findPerson(db, pos[0]);
      if (!p.active) throw Error(`${p.name} is not active`);
      result = (await db.query('insert into claims(person_id,title,purpose) values($1,$2,$3) returning *', [p.id, required(o, 'title'), optional(o, 'purpose')]))[0];
    } else if (cmd === 'add-line') {
      const c = await findClaim(db, pos[0]);
      editable(c);
      id = c.id;
      const k = await findCategory(db, required(o, 'category'));
      const spent = date(required(o, 'date'));
      if (spent > await today(db)) throw Error('A line is for money already spent; the date is in the future');
      const cur = o.currency ? currency(required(o, 'currency')) : c.currency;
      const km = o.km ? Number(required(o, 'km')) : null;
      if (km !== null && !(km > 0 && km < 100000 && /^\d+(\.\d)?$/.test(String(o.km)))) throw Error('--km must be a positive number with at most one decimal');
      if (k.mileage && km === null) throw Error('Mileage needs --km');
      if (k.mileage && cur !== c.currency) throw Error('Mileage is claimed in the home currency');
      let amount = o.amount ? cents(required(o, 'amount')) : null;
      if (amount === null) {
        if (!k.mileage) throw Error('--amount is required');
        amount = Math.round(km * (await policy(db, `mileage_rate_cents_${c.country}`)));
      }
      let fx = 1;
      if (cur !== c.currency) {
        fx = Number(required(o, 'fx'));
        if (!(fx > 0 && fx < 1000)) throw Error(`--fx is ${c.currency} per one ${cur}, for example 1.08`);
      } else if (o.fx) throw Error('--fx only applies to a foreign currency line');
      const home = Math.round(amount * fx);
      let gst = 0;
      if (o.gst !== undefined) gst = String(o.gst).trim() === '0' ? 0 : cents(required(o, 'gst'));
      else if (k.gst_claimable && cur === c.currency) gst = gstOf(home, c.country);
      if (gst >= home) throw Error('GST must be less than the amount');
      let card = null;
      if (o.card) {
        card = (await db.query('select * from card_work where lower(external_ref)=lower($1)', [required(o, 'card')]))[0];
        if (!card) throw Error(`No card transaction ${o.card}`);
        if (card.line_id) throw Error(`Card transaction ${card.external_ref} is already on ${card.claim_ref}`);
        if (card.person_code !== c.person_code) throw Error(`Card transaction ${card.external_ref} is on ${card.person}'s card, not ${c.person}'s`);
        if (Number(card.amount_cents) !== amount || card.currency !== cur) throw Error(`Card transaction is ${card.currency} ${(card.amount_cents / 100).toFixed(2)}; the line must match it`);
      }
      const count = o.count ? int(o.count, 'count') : null;
      result = (await db.query(`insert into claim_lines(claim_id,spent_on,merchant,category_id,amount_cents,currency,fx_rate,home_cents,gst_cents,paid_by,card_txn_id,receipt,evidence,supplier_gst_number,attendees,attendee_count,km,business_purpose,project)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning *`,
        [c.id, spent, required(o, 'merchant'), k.id, amount, cur, fx, home, gst, card ? 'card' : 'personal', card?.id || null, optional(o, 'receipt'), o.evidence ? evidence(required(o, 'evidence')) : o.receipt ? 'receipt' : 'none', optional(o, 'supplier-gst'), optional(o, 'attendees'), count, km, optional(o, 'purpose'), optional(o, 'project')]))[0];
    } else if (cmd === 'receipt') {
      const l = await findLine(db, pos[0]);
      if (!['draft', 'returned', 'submitted'].includes(l.claim_status)) throw Error(`Claim ${l.ref} is ${l.claim_status}; receipts change only before approval`);
      if (o.declare !== undefined) {
        if (o.receipt !== undefined) throw Error('Give a receipt or a declaration, not both');
        result = (await db.query('update claim_lines set receipt_declaration=$2 where id=$1 returning *', [l.id, `${required(o, 'declare')} (declared by ${actor})`]))[0];
      } else {
        result = (await db.query('update claim_lines set receipt=$2,evidence=$3,supplier_gst_number=coalesce($4,supplier_gst_number) where id=$1 returning *', [l.id, required(o, 'receipt'), o.evidence ? evidence(required(o, 'evidence')) : 'receipt', optional(o, 'supplier-gst')]))[0];
      }
    } else if (cmd === 'match-card') {
      const card = (await db.query('select * from card_work where lower(external_ref)=lower($1)', [pos[0]]))[0];
      if (!card) throw Error(`No card transaction ${pos[0]}`);
      if (card.line_id) throw Error(`Card transaction ${card.external_ref} is already on ${card.claim_ref}`);
      const l = await findLine(db, pos[1]);
      if (!['draft', 'returned', 'submitted'].includes(l.claim_status)) throw Error(`Claim ${l.ref} is ${l.claim_status}`);
      const owner = (await db.query('select code from people where id=$1', [l.person_id]))[0].code;
      if (owner !== card.person_code) throw Error(`Card transaction is on ${card.person}'s card, not the claimant's`);
      if (Number(l.amount_cents) !== Number(card.amount_cents) || l.currency !== card.currency) throw Error('Card transaction amount and currency do not match the line');
      if (l.card_txn_id) throw Error('Line is already matched to a card transaction');
      result = (await db.query("update claim_lines set card_txn_id=$2,paid_by='card' where id=$1 returning *", [l.id, card.id]))[0];
    } else if (cmd === 'batch') {
      const e = await findEntity(db, pos[0]);
      const file = path.resolve(REPO_ROOT, required(o, 'file'));
      if (fs.existsSync(file)) throw Error(`${path.relative(REPO_ROOT, file)} already exists`);
      const ready = await db.query("select * from claim_totals where status='approved' and batch_id is null and entity=$1 order by ref", [e.code]);
      if (!ready.length) throw Error(`No approved claims waiting for ${e.code}`);
      const held = await db.query("select ref,finding from compliance_findings where rule='EX05' and ref = any($1::text[])", [ready.map((r) => r.ref)]);
      if (held.length) { const err = Error(`Batch blocked: ${held.length} claim(s) fail the approval check. Return them for a proper approval first.`); err.candidates = held; throw err; }
      const lines = await db.query("select ref,person_code,person,spent_on,merchant,category,gl_account,cost_centre,project,home_cents-gst_cents as net_cents,gst_cents,home_cents,paid_by,evidence from line_work where claim_id = any($1::uuid[]) order by ref,spent_on", [ready.map((r) => r.id)]);
      const n = Number((await db.query('select count(*)::int n from batches where entity_id=$1', [e.id]))[0].n) + 1;
      const ref = `${e.code}-${String(n).padStart(4, '0')}`;
      const total = ready.reduce((s, r) => s + Number(r.total_cents), 0);
      const header = ['claim', 'person_code', 'person', 'date', 'merchant', 'category', 'account', 'cost_centre', 'project', 'net', 'gst', 'gross', 'paid_by', 'evidence', 'batch'];
      const body = lines.map((l) => [l.ref, l.person_code, l.person, String(l.spent_on).slice(0, 10), l.merchant, l.category, l.gl_account, l.cost_centre, l.project, (l.net_cents / 100).toFixed(2), (l.gst_cents / 100).toFixed(2), (l.home_cents / 100).toFixed(2), l.paid_by, l.evidence, ref].map(csvCell).join(','));
      const b = (await db.query('insert into batches(ref,entity_id,file,claims,total_cents,actor) values($1,$2,$3,$4,$5,$6) returning *', [ref, e.id, path.relative(REPO_ROOT, file).split(path.sep).join('/'), ready.length, total, actor]))[0];
      await db.query("update claims set status='exported',batch_id=$2 where id = any($1::uuid[])", [ready.map((r) => r.id), b.id]);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, [header.join(','), ...body].join('\r\n') + '\r\n', { flag: 'wx' });
      id = b.id;
      const pay = await db.query("select person,currency,sum(reimburse_cents)::bigint as reimburse_cents from claim_totals where batch_id=$1 group by person,currency having sum(reimburse_cents)>0 order by person", [b.id]);
      result = { batch: ref, entity: e.code, claims: ready.length, lines: lines.length, currency: e.currency, total_cents: total, file: b.file, reimburse: pay, next: 'Import the file into your accounting system and pay the reimbursements from there. Nothing has been paid from here.' };
    } else {
      const c = await findClaim(db, pos[0]);
      id = c.id;
      if (cmd === 'submit') {
        editable(c);
        const count = Number((await db.query('select count(*)::int n from claim_lines where claim_id=$1', [c.id]))[0].n);
        if (!count) throw Error('Submit blocked: the claim has no lines');
        const b = await blockers(db, c.id);
        if (b.length) { const err = Error(`Submit blocked: ${b.length} line(s) need fixing first`); err.candidates = b; throw err; }
        result = (await db.query("update claims set status='submitted',submitted_on=current_date,decided_by=null,decided_on=null where id=$1 returning *", [c.id]))[0];
      } else if (cmd === 'approve') {
        if (c.status !== 'submitted') throw Error(`Claim ${c.ref} is ${c.status}; only submitted claims are approved`);
        const who = await db.query('select * from people where lower(name)=lower($1) or lower(code)=lower($1)', [actor]);
        if (who.length !== 1) throw Error(`Approve blocked: ${actor} is not one person on file. Use your name or code as --actor.`);
        const a = who[0];
        if (a.id === c.person_id) throw Error('Approve blocked: nobody approves their own claim');
        const total = Number((await db.query('select total_cents from claim_totals where id=$1', [c.id]))[0].total_cents);
        if (a.approval_limit_cents == null || Number(a.approval_limit_cents) < total) throw Error(`Approve blocked: the claim is ${dollars(total, c.currency)} and ${a.name}'s approval limit is ${a.approval_limit_cents == null ? 'none' : dollars(a.approval_limit_cents, c.currency)}`);
        if (a.id !== c.manager_id && !(typeof o.delegated === 'string' && o.delegated.trim())) throw Error(`Approve blocked: ${a.name} is not ${c.person}'s manager. Pass --delegated="<why>" to approve on their behalf.`);
        const b = await blockers(db, c.id);
        if (b.length) { const err = Error(`Approve blocked: ${b.length} line(s) need fixing first`); err.candidates = b; throw err; }
        result = (await db.query("update claims set status='approved',decided_by=$2,decided_on=current_date,decision_note=$3 where id=$1 returning *", [c.id, a.name, o.delegated ? `Approved on behalf of the manager: ${o.delegated.trim()}` : 'Approved']))[0];
      } else if (cmd === 'return') {
        if (!['submitted', 'approved'].includes(c.status)) throw Error(`Claim ${c.ref} is ${c.status}; only submitted or approved claims go back`);
        if (c.batch_id) throw Error('Claim is in a batch');
        result = (await db.query("update claims set status='returned',decided_by=$2,decided_on=current_date,decision_note=$3 where id=$1 returning *", [c.id, actor, required(o, 'reason')]))[0];
      } else if (cmd === 'reject') {
        if (!['submitted', 'returned'].includes(c.status)) throw Error(`Claim ${c.ref} is ${c.status}`);
        result = (await db.query("update claims set status='rejected',decided_by=$2,decided_on=current_date,decision_note=$3 where id=$1 returning *", [c.id, actor, required(o, 'reason')]))[0];
      } else throw Error('Unimplemented command ' + cmd);
    }
    await audit(db, cmd, id || result.id, actor, { args: pos, ...o });
    return result;
  });
}

// SAP Concur's Expense File Export and Standard Accounting Extract layouts are set per company.
// These are the common headings; anything else goes in a mapping file.
const aliases = {
  report: ['Report ID', 'Report Key', 'report_id'], employee: ['Employee ID', 'Employee Login ID', 'employee_id'], title: ['Report Name', 'report_name'],
  date: ['Transaction Date', 'Expense Date', 'date'], type: ['Expense Type', 'Expense Type Name', 'expense_type'], vendor: ['Vendor', 'Vendor Description', 'Merchant', 'vendor'],
  amount: ['Journal Amount', 'Approved Amount', 'Transaction Amount', 'amount'], currency: ['Reimbursement Currency', 'Transaction Currency', 'Currency'],
  tax: ['Tax Amount', 'Total Tax Posted Amount', 'tax'], purpose: ['Business Purpose', 'Purpose'], payment: ['Payment Type', 'Payment Type Name'],
  status: ['Approval Status', 'Report Status', 'Status'], approver: ['Approver', 'Approver Name', 'Approved By'], submitted: ['Report Submit Date', 'Submit Date'],
  receipt: ['Receipt Received', 'Receipt Image Available', 'Has Receipt'],
};
function columnReader(map) {
  for (const [k, v] of Object.entries(map)) if (!(k in aliases) || typeof v !== 'string' || !v) throw Error('Invalid column mapping ' + k);
  return (row, k) => {
    const names = map[k] ? [map[k]] : aliases[k];
    const hits = Object.keys(row).filter((h) => names.some((n) => n.toLowerCase() === h.toLowerCase()));
    if (hits.length > 1) throw Error('Ambiguous columns for ' + k + ': ' + hits.join(', '));
    return hits.length ? String(row[hits[0]]).trim() : '';
  };
}
const usDate = (v) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : v; };
function concurStatus(v) {
  const s = v.toLowerCase();
  if (/approved|processed|paid|sent for payment|extracted/.test(s)) return 'exported';
  if (/submitted|pending/.test(s)) return 'submitted';
  return 'draft';
}
async function importConcur(db, o, actor) {
  const mapping = o.map ? JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'map')), 'utf8')) : {};
  const value = columnReader(mapping.columns || {});
  const types = Object.fromEntries(Object.entries(mapping.types || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const rows = parseCsv(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'file')), 'utf8'));
  if (!rows.length) throw Error('CSV contains no records');
  const people = new Map((await db.query(personSql)).map((p) => [p.code.toLowerCase(), p]));
  const cats = await db.query('select * from categories');
  const catOf = (t) => { const want = (types[t.toLowerCase()] || t).toLowerCase(); return cats.find((c) => c.code.toLowerCase() === want || c.name.toLowerCase() === want); };
  const unknownPeople = new Set(), unknownTypes = new Set();
  const clean = rows.map((row, i) => {
    try {
      const report = value(row, 'report'); if (!report) throw Error('report id is empty');
      const emp = value(row, 'employee'); const p = people.get(emp.toLowerCase()); if (!p) unknownPeople.add(emp || '(blank)');
      const type = value(row, 'type'); const k = catOf(type); if (!k) unknownTypes.add(type || '(blank)');
      const amount = cents(value(row, 'amount').replace(/,/g, ''));
      const cur = value(row, 'currency') || p?.currency;
      if (p && cur !== p.currency) throw Error(`amount is in ${cur} but ${p.name} is paid in ${p.currency}; map the reimbursement currency amount instead`);
      const taxRaw = value(row, 'tax').replace(/,/g, '');
      const tax = !taxRaw || Number(taxRaw) === 0 ? 0 : cents(taxRaw);
      if (tax >= amount) throw Error('tax is not less than the amount');
      const submittedRaw = usDate(value(row, 'submitted'));
      return {
        report, p, k, amount, tax, spent: date(usDate(value(row, 'date'))), vendor: value(row, 'vendor') || type, title: value(row, 'title') || `Concur report ${report}`,
        purpose: value(row, 'purpose') || null, card: /company|corporate|card/i.test(value(row, 'payment')), status: concurStatus(value(row, 'status')),
        approver: value(row, 'approver') || null, submitted: submittedRaw ? date(submittedRaw.slice(0, 10)) : null, receipt: yesNo(value(row, 'receipt')),
      };
    } catch (e) { throw Error(`Row ${i + 2}: ${e.message}`); }
  });
  if (unknownPeople.size || unknownTypes.size) {
    const err = Error(`Import stopped before writing anything. ${unknownPeople.size ? `Add these people first (add-person, with their Concur employee ID as --code): ${[...unknownPeople].join(', ')}. ` : ''}${unknownTypes.size ? `Map these expense types to a category in the mapping file's "types": ${[...unknownTypes].join(', ')}.` : ''}`);
    err.candidates = [...unknownTypes].map((t) => ({ expense_type: t, categories: cats.map((c) => c.code).join(' ') }));
    throw err;
  }
  const reports = new Map();
  for (const r of clean) { if (!reports.has(r.report)) reports.set(r.report, []); reports.get(r.report).push(r); }
  return tx(db, async () => {
    let claimsAdded = 0, linesAdded = 0, unchanged = 0;
    for (const [report, lines] of reports) {
      const ref = `CONCUR-${report}`;
      if (new Set(lines.map((l) => l.p.id)).size > 1) throw Error(`Report ${report} has rows for more than one employee`);
      const existing = (await db.query('select id,(select count(*)::int from claim_lines where claim_id=claims.id) as n from claims where ref=$1', [ref]))[0];
      if (existing) { if (existing.n === lines.length) { unchanged++; continue; } throw Error(`${ref} is already here with ${existing.n} lines; the file has ${lines.length}. Review before importing.`); }
      const f = lines[0];
      const c = (await db.query('insert into claims(ref,person_id,title,purpose,status,submitted_on,decided_by,decided_on,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id', [ref, f.p.id, f.title, f.purpose, f.status, f.status === 'draft' ? null : f.submitted || f.spent, f.status === 'exported' ? f.approver : null, f.status === 'exported' ? f.submitted || f.spent : null, `concur: ${path.basename(o.file)}`]))[0];
      for (const l of lines) {
        await db.query('insert into claim_lines(claim_id,spent_on,merchant,category_id,amount_cents,currency,home_cents,gst_cents,paid_by,receipt,evidence,business_purpose) values($1,$2,$3,$4,$5,$6,$5,$7,$8,$9,$10,$11)',
          [c.id, l.spent, l.vendor, l.k.id, l.amount, l.p.currency, l.tax, l.card ? 'card' : 'personal', l.receipt ? `concur report ${report}` : null, l.receipt ? 'receipt' : 'none', l.purpose]);
        linesAdded++;
      }
      claimsAdded++;
    }
    await audit(db, 'import concur', null, actor, { file: path.basename(o.file), rows: clean.length, claims: claimsAdded, lines: linesAdded, unchanged });
    if (o['dry-run']) { await db.exec('ROLLBACK'); await db.exec('BEGIN'); }
    return { rows: clean.length, reports: reports.size, claims_added: claimsAdded, lines_added: linesAdded, reports_unchanged: unchanged, dry_run: !!o['dry-run'], note: 'Paid Concur reports land as exported history and are never batched again. Open ones land as submitted or draft.' };
  });
}

// A company card statement saved as CSV from the bank: date, card, description, amount, reference.
async function importCards(db, o, actor) {
  const rows = parseCsv(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'file')), 'utf8'));
  if (!rows.length) throw Error('CSV contains no records');
  const pick = (row, ...names) => { const k = Object.keys(row).find((h) => names.some((n) => n.toLowerCase() === h.toLowerCase())); return k === undefined ? '' : String(row[k]).trim(); };
  return tx(db, async () => {
    let added = 0, unchanged = 0, credits = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const raw = pick(row, 'amount', 'debit', 'transaction amount').replace(/,/g, '');
        if (/^-/.test(raw) || /^\(.*\)$/.test(raw)) { credits++; continue; }
        const last4 = pick(row, 'card', 'card number', 'last 4').replace(/\D/g, '').slice(-4);
        const card = (await db.query('select k.id,e.currency from cards k join people p on p.id=k.person_id join entities e on e.id=p.entity_id where k.last4=$1', [last4]))[0];
        if (!card) throw Error(`no card ending ${last4 || '(blank)'}; add it with add-card`);
        const ref = pick(row, 'reference', 'transaction id', 'ref');
        if (!ref) throw Error('reference is empty');
        const txn = { ref, card: card.id, date: date(pick(row, 'date', 'transaction date')), merchant: pick(row, 'description', 'merchant', 'details') || 'Unknown', amount: cents(raw), currency: currency(pick(row, 'currency') || card.currency) };
        const old = (await db.query('select card_id,amount_cents,txn_date::text as d from card_transactions where external_ref=$1', [ref]))[0];
        if (old) {
          if (old.card_id === txn.card && Number(old.amount_cents) === txn.amount && old.d === txn.date) { unchanged++; continue; }
          throw Error(`reference ${ref} is already recorded with different details`);
        }
        await db.query('insert into card_transactions(external_ref,card_id,txn_date,merchant,amount_cents,currency,source) values($1,$2,$3,$4,$5,$6,$7)', [txn.ref, txn.card, txn.date, txn.merchant, txn.amount, txn.currency, path.basename(o.file)]);
        added++;
      } catch (e) { throw Error(`Row ${i + 2}: ${e.message}`); }
    }
    await audit(db, 'import cards', null, actor, { file: path.basename(o.file), rows: rows.length, added, unchanged, credits });
    if (o['dry-run']) { await db.exec('ROLLBACK'); await db.exec('BEGIN'); }
    return { rows: rows.length, added, unchanged, credits_skipped: credits, dry_run: !!o['dry-run'] };
  });
}

export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '(none)';
    const keys = [...new Set(value.flatMap(Object.keys))];
    return table(value, keys.map((key) => ({
      key, label: key.replace(/_cents$/, '').replace(/_/g, ' '),
      align: /(_cents|_days|lines|claims|findings|receipts|count|km)$/.test(key) ? 'right' : undefined,
      format: (v) => v == null ? '' : key.endsWith('_cents') ? (Number(v) / 100).toFixed(2) : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' ? JSON.stringify(v) : String(v),
    })));
  }
  if (value && typeof value === 'object') {
    if (Object.values(value).every((v) => v === null || typeof v !== 'object' || v instanceof Date)) return human([value]);
    return Object.entries(value).map(([k, v]) => `${k.replace(/_/g, ' ')}\n${v && typeof v === 'object' && !(v instanceof Date) ? human(Array.isArray(v) ? v : [v]) : String(v)}`).join('\n\n');
  }
  return String(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    if (process.argv.includes('--json')) console.error(JSON.stringify({ error: e.message, candidates: e.candidates || [] }));
    else { console.error(e.message); if (e.candidates?.length) console.error(human(e.candidates)); }
    process.exitCode = 1;
  } finally { if (db) await db.close(); }
}
