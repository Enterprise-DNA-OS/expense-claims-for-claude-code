---
description: GST on claims by entity and month, split into supported and at risk.
---

Run: `npm run expense -- gst`

At risk means the document held does not support the credit (rules EX02 and EX03) or there is no receipt. Tell the operator the at-risk amount and which lines to fix before the return is filed.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
