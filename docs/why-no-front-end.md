# Expense claims without a front end

Finance's week with expenses is a handful of questions: what is waiting on whom, which receipts are missing, which GST credits are not backed by the right document, which card charges nobody has claimed, and what goes in this week's batch. Each of those is one query against a database. Claude Code runs it when you ask in plain words.

What a screen gives that this does not: a phone app that photographs a receipt and reads it, an approve button in the approver's inbox, a live card feed from the bank, and a travel booking tool. The free version has none of those. Claimants or finance add lines by asking, receipts are a file path or link, card charges come from the bank's statement export, and approvers approve by asking. Read-only HTML views (`npm run view`) and branded claim forms and registers (`npm run docs`) cover what people need to see.

If your team needs a receipt app, approvals by email or a live bank feed, Enterprise DNA builds them into your version. The database stays yours either way.

Installed and run for you: https://enterprisedna.co/omni/instead-of/sap-concur
