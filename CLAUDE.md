# Expense Claims for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS] (the demo is Tasman Engineering Consultants, with an NZ and an Australian company)
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| the one list of everything in expenses that needs a person this week | `/attention` |
| the Monday expenses review | `/weekly-review` |
| every claim with its status, total and who decided it | `/claims` |
| one claim: every line, its evidence, the totals and the checks that apply to it | `/claim` |
| everyone who claims, their entity, manager, approval limit and cards | `/people` |
| one person: their claims, card charges with no claim, and the claims waiting for them to approve | `/person` |
| the expense categories, their accounts and rules | `/categories` |
| claims waiting for approval, longest wait first, with the approver and what the checks found | `/approvals` |
| approve a submitted claim | `/approve` |
| send a claim back to the claimant with a reason | `/return` |
| reject a claim outright | `/reject` |
| start a claim for a person | `/new-claim` |
| add a receipt, card charge or mileage trip to a draft or returned claim | `/add-line` |
| attach a receipt to a line, or record a declaration when the receipt is lost | `/receipt` |
| submit a claim for approval | `/submit` |
| company card charges with no claim line yet | `/card-unmatched` |
| link a company card charge to the claim line that explains it | `/match-card` |
| add a person who claims or approves | `/add-person` |
| record a company card against its holder | `/add-card` |
| approved claims not yet in a batch, and whether each can go | `/export-ready` |
| write the accounting file for every approved claim in an entity and mark them exported | `/batch` |
| every reimbursement batch written so far | `/batches` |
| spend over the last three months by entity, cost centre and category | `/spend` |
| gST on claims by entity and month, split into supported and at risk | `/gst` |
| every entertainment line this year with attendees and purpose | `/entertainment` |
| spend claimed twice: the same line on two claims, or a personal claim a company card already paid | `/duplicates` |
| check the claims against the rules in docs/compliance.md | `/compliance` |
| the thresholds and rates the checks use | `/policy` |
| the audit trail: every change, who made it, with what | `/history` |
| bring a SAP Concur expense export or a company card statement across | `/import` |
| write every record to one JSON file | `/export` |
| draft a reminder to one person about card charges and claims they need to finish | `/draft-reminder` |
| write the weekly expenses review to drafts/ | `/draft-review` |
| make this system yours in plain language. Add a field, rename a category, change a rule or a threshold, add a column to a document. Writes the migration, applies it, updates the commands that touch it | `/customise` |
| add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator brand by `npm run view` | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run expense -- help`) and then propose a new command for it.

## Hard rules

- Never pay anyone. A batch writes a file for the accounting system; a person pays from there.
- Never approve on the operator's behalf. `--actor` is the person approving, and they must say so in this session.
- Never add NZD and AUD together. Totals stay in each entity's currency.
- Receipt images and batch files stay out of git (`receipts/`, `batches/`).
- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off SAP Concur.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/sap-concur
