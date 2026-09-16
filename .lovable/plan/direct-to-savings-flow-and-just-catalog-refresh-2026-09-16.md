# Direct-to-savings flow and JUST catalog refresh

## What will change
- Rename the experience to **“JUST ke saath Grocery main Bachat”** across the visible app and page metadata.
- Remove the verification page so a successful bill scan opens the savings result immediately.
- Make the total savings the strongest visual element on the result page.
- List matched JUST alternatives first, followed by a separate **“JUST par available nahi”** section for unmatched and excluded items.

## Price sheet
- Replace the current catalog with rows from the revised workbook that contain a valid product name, price, and packet size.
- Convert packet sizes into normalized grams, millilitres, or units; bundle sizes such as `3 × 100 g` become `300 g`.
- Use the workbook’s **SKU Reference** as the primary like-for-like match phrase, with the JUST SKU name as supporting match text.
- Skip incomplete rows rather than estimating missing prices or packet sizes.

## Matching safeguards
- Match only products from the same unit family.
- Score meaningful words from the scanned product against the reference product instead of using a loose single-word substring.
- When the sheet contains multiple packet sizes for one reference product, choose the closest size before calculating the equivalent JUST price.
- Keep all comparisons quantity-normalized using the packet size supplied in the workbook.

## Validation
- Check catalog row counts and normalized packet sizes after import.
- Test direct scan-to-results behavior and verify matched items always appear before unavailable items on desktop and mobile.
