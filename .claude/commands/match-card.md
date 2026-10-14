---
description: Link a company card charge to the claim line that explains it.
---

Run: `npm run expense -- match-card <card-ref> <line-id> --actor=`

Same person, same amount and currency. The line becomes card-paid and is not reimbursed.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
