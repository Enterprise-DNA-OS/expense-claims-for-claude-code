---
description: Send a claim back to the claimant with a reason.
---

Run: `npm run expense -- return <claim> --reason= --actor=`

Works on submitted or approved claims not yet batched. The reason is what the claimant reads, so make it specific: which line, what is missing.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
