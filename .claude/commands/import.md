---
description: Bring a SAP Concur expense export or a company card statement across.
---

Run: `npm run expense -- import concur --file= --map=examples/import-map.json --dry-run --actor=`

Always dry run first and show the counts. It stops before writing anything if a person or expense type is unknown: add the people, map the types in the mapping file, run again. Paid Concur reports land as exported history. For cards: npm run expense -- import cards --file= --actor=. Read docs/replace-sap-concur.md.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
