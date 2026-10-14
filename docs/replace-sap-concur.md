# Move your expenses from SAP Concur

Sources checked 14 October 2026: [SAP Learning, exploring the basics of Expense File Export](https://learning.sap.com/learning-journeys/getting-started-with-concur-expense-standard-for-administrators/exploring-the-basics-of-expense-file-export) and [SAP Concur Developer Center, Extracts](https://developer.concur.com/api-reference/common/extracts/v1.extracts.html).

Concur Expense Standard writes an Expense File Export when payment batches close, in the default GL layout or a custom one your administrator sets up. Larger customers use the Standard Accounting Extract or Extract Services, whose columns are defined per company. Any of them, or a report saved as CSV, works here: one row per expense line with the report, the employee, the date, the expense type and the amount.

## One command, dry run first

1. Add your people with their Concur employee ID as the code: `npm run expense -- add-person --code=<employee id> --name= --entity= --manager= --actor=`. Set approval limits with `--limit`.
2. Copy `examples/import-map.json` and map each Concur expense type to one of your categories under `types`. Column headings that differ from the common ones go under `columns` (for example `"amount": "Approved Amount (rpt)"`).
3. Dry run: `npm run expense -- import concur --file=imports/concur.csv --map=imports/map.json --actor="Your name" --dry-run`
4. If it stops, it lists every unknown employee ID and expense type at once. Add or map them and run again.
5. Run without `--dry-run`. Check `/claims` and `/compliance`.

Headings read without a mapping: Report ID, Employee ID, Report Name, Report Submit Date, Approval Status, Approver, Transaction Date, Expense Type, Vendor Description, Payment Type, Journal Amount (or Approved Amount), Reimbursement Currency, Tax Amount, Business Purpose, Receipt Received. Dates can be YYYY-MM-DD or MM/DD/YYYY.

Reports Concur shows as approved, processed, paid or extracted land as exported history: they count in spend, GST and the duplicate checks, and are never batched or paid again. Submitted or pending reports land as submitted; anything else lands as draft. Corporate card lines land as card-paid. Each report becomes one claim, `CONCUR-<report id>`. Re-importing the same file changes nothing; a report already here with a different number of lines is refused for review.

## Company cards

Save each card statement from your bank as CSV with date, card number (only the last four digits are kept), description, amount and a reference, and run `npm run expense -- import cards --file=imports/visa-october.csv --actor=`. Credits and refunds are skipped. Add each card first with `add-card`.

## What does not carry over

Receipt images stay in Concur: export them from Concur's report PDFs or your archive and record where each is kept with `/receipt`. Concur's approval chains, audit rules, travel bookings, ExpenseIt receipt reading, card feeds and its connection to your accounting system do not come across through an export. Amounts are imported in the reimbursement currency, so foreign spend arrives already converted. Enterprise DNA maps a custom extract layout, receipt archive or approval chain as part of bringing your data across.
