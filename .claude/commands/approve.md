---
description: Approve a submitted claim.
---

Run: `npm run expense -- approve <claim> --actor="<approver name or code>"`

The approver must be a person on file, not the claimant, with a limit at or above the claim total. Anyone but the claimant's manager needs --delegated="<why>". It stops on missing receipts and incomplete entertainment records. Read /claim first and tell the operator what they are approving.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
