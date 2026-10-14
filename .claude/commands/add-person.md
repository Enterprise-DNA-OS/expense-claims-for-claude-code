---
description: Add a person who claims or approves.
---

Run: `npm run expense -- add-person --code= --name= --entity= [--manager=] [--limit=] --actor=`

Use their payroll or Concur employee ID as --code so imports match. --limit is the largest claim they may approve.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
