---
description: Write the accounting file for every approved claim in an entity and mark them exported.
---

Run: `npm run expense -- batch <entity> --file=batches/<name>.csv --actor=`

Run /export-ready first. The file has one row per line with account, cost centre, net, GST and gross, for import into Xero, MYOB or your ERP. Show the reimbursement per person. Nothing is paid from here, and exported lines can no longer change.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
