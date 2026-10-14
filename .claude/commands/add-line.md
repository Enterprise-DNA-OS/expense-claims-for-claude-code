---
description: Add a receipt, card charge or mileage trip to a draft or returned claim.
---

Run: `npm run expense -- add-line <claim> --date=YYYY-MM-DD --merchant= --category= --amount= --actor=`

GST is worked out from the entity (3/23 in NZ, 1/11 in AU) unless --gst is given, and is zero on foreign currency and mileage. Foreign spend needs --fx (home currency per one unit). Mileage takes --km and is paid at the company rate. A company card charge takes --card=<reference> and must match it exactly. Set --evidence=tax_invoice or tax_invoice_named when the document qualifies, and record attendees, --count and --purpose on entertainment.

Options use --name=value. Add --json for structured output. Show money with its currency, GST included unless stated. Drafts go to drafts/ and are never sent from here. Nothing here pays anyone.
