# Expense claim record checks

`/compliance` runs `npm run expense -- compliance`. It checks the claims against the rules below and lists what it finds. It is not tax advice and does not certify that a claim, a GST return or an FBT return is right. Sources checked 14 October 2026. Confirm the rules that apply to your business with your adviser, then change the checks with `/customise`.

| Rule | What the check finds | Basis |
|---|---|---|
| EX01 | A line above the receipt threshold has no receipt and no declaration. | Your policy (`receipt_over_cents`, NZD or AUD 25.00 in the demo). Both tax authorities expect records that support every expense claimed. |
| EX02 | Australia: a GST credit on a purchase over AUD 82.50 with no tax invoice, or on a purchase of AUD 1,000 or more with a tax invoice that does not identify the business. | ATO: you need a tax invoice to claim a GST credit for purchases over $82.50 including GST. A tax invoice for $1,000 or more must show the buyer's identity or ABN. |
| EX03 | New Zealand: GST claimed on a supply over NZD 200 with no taxable supply information, or over NZD 1,000 without information that names the business. | Inland Revenue: taxable supply information for supplies over $200 shows the seller's GST number; over $1,000 it also shows the buyer's name and one identifier. In force from 1 April 2023. |
| EX04 | An entertainment line with no attendees, head count or business purpose. | Australia: entertainment may be a fringe benefit, and the 12-week register and actual-cost methods both need to know who attended. New Zealand: entertainment is often 50% deductible and the treatment depends on who attended and why. |
| EX05 | A claim approved by the person who claimed it, by someone not on file, or above the approver's limit. | Your policy. Segregation of duties: nobody approves their own spend. Limits are in `people.approval_limit_cents`. |
| EX06 | The same person, date, merchant and amount on two claims. | Your policy. A duplicate claim pays twice. |
| EX07 | A line claimed as paid personally that matches a company card charge for the same person, date and amount. | Your policy. The card paid it; reimbursing it pays twice. |
| EX08 | A line submitted more than `late_claim_days` (60) after the money was spent. | Your policy. Late claims miss the GST period they belong to and are harder to check. |
| EX09 | Mileage paid above the company rate per km. | Your policy (`mileage_rate_cents_NZ`, `mileage_rate_cents_AU`). Set them from the IRD kilometre rate or the ATO cents per km rate you adopt. |
| EX10 | One person's lines in a category with a daily limit go over it on one day. | Your policy (`categories.daily_limit_cents`, meals at 80.00 in the demo). |

## Sources

- EX02: [ATO, when you can claim a GST credit](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/when-you-can-claim-a-gst-credit). Tax invoice required for purchases over $82.50 including GST; the supplier must give one within 28 days of a request.
- EX03: [Inland Revenue, how taxable supply information for GST works](https://www.ird.govt.nz/gst/tax-invoices-for-gst/how-tax-invoices-for-gst-work) and [taxable supply information](https://www.ird.govt.nz/gst/tax-invoices-for-gst). Over $200: seller name, GST number, date, description, amount. Over $1,000: the buyer's name and at least one of address, phone, email, trading name, NZBN or website.
- EX04, Australia: [ATO, entertainment-related fringe benefits](https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/fringe-benefits-tax/types-of-fringe-benefits/entertainment-related-fringe-benefits) and [calculating the taxable value of entertainment-related benefits](https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/fringe-benefits-tax/types-of-fringe-benefits/entertainment-related-fringe-benefits/calculating-the-taxable-value-of-entertainment-related-benefits). The FBT year runs 1 April to 31 March. The 12-week register method needs the cost and recipients of each meal entertainment.
- EX04, New Zealand: [Inland Revenue, entertainment expenses](https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses/entertainment-expenses). Entertainment that is not wholly business is generally 50% deductible under sections DD 1 to DD 11 of the Income Tax Act 2007, with exceptions such as entertainment enjoyed outside New Zealand.
- EX09: [Inland Revenue, kilometre rates for business use of vehicles](https://www.ird.govt.nz/income-tax/income-tax-for-businesses-and-organisations/types-of-business-expenses/claiming-vehicle-expenses/kilometre-rates-for-business-use-of-vehicles) and [ATO, cents per kilometre method](https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/cars-transport-and-travel/motor-vehicle-and-car-expenses/using-your-own-car-for-work/cents-per-kilometre-method). Both rates are published each year; the demo rates are examples, not the published figures.

## What the checks do not do

They do not read receipts. Whether a document is a tax invoice, or names the business, is whatever the claimant or finance records in `evidence`. They do not decide FBT or the 50% treatment: the entertainment register gives your adviser who attended and why. They do not work out GST on mixed business and private use, apportion entertainment GST, or check a supplier's GST registration. Keep records for the period the law requires: five years in Australia and seven in New Zealand for most business records.

Policy numbers live in the `policy` and `categories` tables. Change them through a migration with `/customise`, so the history shows when a rule changed.
