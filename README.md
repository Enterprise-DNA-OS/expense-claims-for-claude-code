<h1 align="center">Expense Claims for Claude Code</h1>

<p align="center">
  <strong>The open-source expense claims system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your SAP Concur data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=sap-concur">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/sap-concur?utm_source=github&utm_medium=readme&utm_campaign=sap-concur">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-sap-concur">Instead of SAP Concur</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Expense Claims for Claude Code does the job you pay SAP Concur for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it answers your own questions against your own records.

SAP Concur prices Concur Expense per report: its own pricing page lists Base from US$7 a report and Plus from US$11 a report, with Premium on a custom quote and the price varying with your monthly commitment ([docs/research.md](docs/research.md)). Every claim your team files is another charge, every month, on top of card feeds, audit services and the implementation project. The work underneath is a list of people, receipts, rules and approvals, and that is what this holds.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=sap-concur).

It is for New Zealand and Australian firms whose staff spend money for work: professional services, engineering and consulting, distributors with reps on the road, anyone with trans-Tasman teams. It covers claims and their lines, receipts and declarations, GST worked out by country, the tax invoice and taxable supply information rules for GST credits, entertainment records for FBT and the 50% rules, mileage at your rate, per day limits, approvals with limits and delegation, company card matching, duplicate checks and the reimbursement batch file for your accounting system. The demo is Tasman Engineering Consultants, with an NZ company and an Australian one.

## Ten questions your own version answers

Each one is a command that works today on the demo data.

- Which claims have waited more than five days for approval, and who is sitting on them? `/approvals`
- How much GST are we claiming without the tax invoice to back it? `/gst`
- Which company card charges still have no claim against them? `/card-unmatched`
- Who claimed the same taxi twice, or claimed a card charge as their own money? `/duplicates`
- Which claims were approved by the claimant, or above the approver's limit? `/compliance`
- Which client dinners have no attendee list for the entertainment record? `/entertainment`
- Who is claiming mileage above the company rate? `/compliance`
- What did each team spend on flights and accommodation over the last three months? `/spend`
- Which claims came in more than 60 days after the money was spent? `/compliance`
- What do we owe each person in the next reimbursement batch, and what is holding it? `/export-ready`

## Your first hour: ten things to ask for

1. Put our business name and logo on the expense claim form.
2. What needs a person this week?
3. Show me every GST credit we cannot back with the right document.
4. Load our Concur expense export as a dry run.
5. Load last month's company card statement and show me what nobody has claimed.
6. Draft a reminder to Liam about his card charges.
7. Which claims is Aroha holding, and for how long?
8. Our meals limit is $90 a day in Australia, not $80. Change it.
9. Add a client code to every claim line.
10. Write the batch file for the NZ company and tell me who gets paid what.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/expense-claims-for-claude-code.git
cd expense-claims-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`: everything in the demo firm's expenses that needs a person this week. `npm test` runs every command against a throwaway database.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | The one list of everything in expenses that needs a person this week. |
| `/weekly-review` | The Monday expenses review. |
| `/claims` | Every claim with its status, total and who decided it. |
| `/claim` | One claim: every line, its evidence, the totals and the checks that apply to it. |
| `/people` | Everyone who claims, their entity, manager, approval limit and cards. |
| `/person` | One person: their claims, card charges with no claim, and the claims waiting for them to approve. |
| `/categories` | The expense categories, their accounts and rules. |
| `/approvals` | Claims waiting for approval, longest wait first, with the approver and what the checks found. |
| `/approve` | Approve a submitted claim. |
| `/return` | Send a claim back to the claimant with a reason. |
| `/reject` | Reject a claim outright. |
| `/new-claim` | Start a claim for a person. |
| `/add-line` | Add a receipt, card charge or mileage trip to a draft or returned claim. |
| `/receipt` | Attach a receipt to a line, or record a declaration when the receipt is lost. |
| `/submit` | Submit a claim for approval. |
| `/card-unmatched` | Company card charges with no claim line yet. |
| `/match-card` | Link a company card charge to the claim line that explains it. |
| `/add-person` | Add a person who claims or approves. |
| `/add-card` | Record a company card against its holder. |
| `/export-ready` | Approved claims not yet in a batch, and whether each can go. |
| `/batch` | Write the accounting file for every approved claim in an entity and mark them exported. |
| `/batches` | Every reimbursement batch written so far. |
| `/spend` | Spend over the last three months by entity, cost centre and category. |
| `/gst` | GST on claims by entity and month, split into supported and at risk. |
| `/entertainment` | Every entertainment line this year with attendees and purpose. |
| `/duplicates` | Spend claimed twice: the same line on two claims, or a personal claim a company card already paid. |
| `/compliance` | Check the claims against the rules in docs/compliance.md. |
| `/policy` | The thresholds and rates the checks use. |
| `/history` | The audit trail: every change, who made it, with what. |
| `/import` | Bring a SAP Concur expense export or a company card statement across. |
| `/export` | Write every record to one JSON file. |
| `/draft-reminder` | Draft a reminder to one person about card charges and claims they need to finish. |
| `/draft-review` | Write the weekly expenses review to drafts/. |
| `/customise` | Make this system yours in plain language. Add a field, rename a category, change a rule or a threshold, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator brand by `npm run view`. |

Every command runs `npm run expense -- <command>` underneath. `npm run expense -- help` prints the exact syntax. Add `--json` to any command for structured output. Names match without regard to case; an ambiguous name lists the candidates and exits 1.

Every change takes `--actor` and lands in an append-only audit table. Batches and card transactions are history: they cannot be deleted, and the lines on an exported claim cannot change. Nobody approves their own claim or a claim above their limit, and only the claimant's manager approves without a recorded delegation.

## How claims work

Money is stored in whole cents. Each person belongs to an entity, and the entity sets the home currency and the tax rules. A line records what was paid in the currency paid, the rate to the home currency, and the GST in the home currency: 3/23 of the amount for NZ, 1/11 for AU, zero on foreign spend and mileage, unless you enter the GST from the invoice. Mileage is km times the company rate in `policy`. A line paid on a company card points at the card transaction and is not reimbursed.

A claim goes draft, submitted, approved, exported. Returned goes back to the claimant with a reason; rejected stops. Submitting and approving both stop on missing receipts, mileage without km and entertainment without attendees and a purpose. A batch takes every approved claim for one entity, writes one CSV row per line with account, cost centre, net, GST and gross, and marks the claims exported. A claim that fails the approval check holds the batch.

## Documents and views

`npm run docs` writes an expense claim form for every claim, an entertainment register per entity for the year from 1 April, and a reimbursement summary for every batch, in your brand from `brand.json`, to `docs-out/`. `npm run view` writes the week, GST and entertainment, and spend pages to `views/`. `/new-view` adds another.

## Record checks

`/compliance` checks receipts, the Australian tax invoice rule and the New Zealand taxable supply information rules for GST credits, entertainment records, approvals, duplicates, card charges claimed as personal spend, late claims, mileage above your rate and per day limits. The sources are in [docs/compliance.md](docs/compliance.md). It is not tax advice.

## Instead of SAP Concur

Concur's Expense File Export writes report lines to a file your administrator downloads, and the column layout is set per company. One command, dry run first:

```bash
npm run expense -- import concur --file=examples/concur-expense-export.csv --map=examples/import-map.json --actor="Your name" --dry-run
npm run expense -- import concur --file=examples/concur-expense-export.csv --map=examples/import-map.json --actor="Your name"
npm run expense -- import cards --file=examples/card-statement.csv --actor="Your name"
```

It stops before writing anything if a person or expense type is unknown. Paid reports land as exported history, never batched again; open ones land as submitted or draft. The example files are synthetic. Full guide, including what does not carry over: [docs/replace-sap-concur.md](docs/replace-sap-concur.md).

## Architecture

```
expense-claims-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Expense Claims for Claude Code for your business, migrates your SAP Concur data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=sap-concur)
- Read more: [enterprisedna.co/omni/instead-of/sap-concur](https://enterprisedna.co/omni/instead-of/sap-concur?utm_source=github&utm_medium=readme&utm_campaign=sap-concur)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Not affiliated with SAP, SAP Concur or Anthropic.
