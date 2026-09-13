# Just Bill Bachat

Here is the MVP PRD that incorporates the receipt upload and OCR parsing flow, allowing agents to capture D-Mart (or any other hypermarket) bills via camera photo or file upload.




Product Requirement Document (PRD): Bill Comparison Tool (MVP)

An agent-facing tool designed to run instant receipt comparisons outside physical retail stores (D-Mart, Star Bazaar, Reliance Fresh) in Magarpatta and Hadapsar (Pune), driving customer acquisition for Swiggy Instamart's private-label grocery brand, Just.




1. Executive Summary & Goals

Objective: Intercept offline hypermarket shoppers post-checkout to demonstrate direct cost savings when switching to Just private-label products.

Target Audience: On-ground sales agents (primary users) pitching to shoppers in Pune.

Core Value Proposition: Real-time receipt scanning and unit-normalized price comparisons with 100% transparency on edge cases.

Success Metrics:




Scan-to-Pitch Time: <20 seconds from uploading/capturing a physical bill to rendering the comparative savings dashboard.

OCR Parsing Accuracy: >90% precision on item descriptions, unit quantities, and final paid prices across thermal receipts.

2. Updated User & Data Flow (Bill Upload to Pitch)

 [ Agent Screen: Capture Bill ]
                |
    (Camera Photo or PDF/Image Upload)
                |
 [ OCR & Receipt Parsing Engine ]
    - Extracts Store Name, Item Names, Pack Quantities, & Final Prices
                |
 [ Agent Verification Screen ] 
    - Quick 5-second sanity check / manual edit override by agent
                |
 [ Categorization & Normalization Engine ]
    - Filters out non-grocery/excluded categories
    - Maps 3rd party national brands -> Just private label equivalents
    - Calculates normalized unit cost parity
                |
 [ Customer Savings Pitch Dashboard ]
    - Displays net bachat, item-level breakdowns, and QR code to order


3. Detailed Feature Breakdown: Bill Upload & Parsing Flow

3.1. Bill Capture Interface

Camera Capture: Integrated camera viewfinder with real-time framing guides tailored for long vertical thermal receipts.

Multi-Page / Long Receipt Mode: Option to stitch 2-3 overlapping photos if the physical receipt is unusually long.

File Upload Fallback: Support for uploading PNG, JPG, JPEG, or PDF files directly from the device gallery.

3.2. Receipt Processing & Verification Step (Agent Safety Net)

To account for faded thermal ink or OCR misreads, the app routes parsed results through a quick Agent Verification Modal before generating the final pitch:




Plaintext

+-------------------------------------------------------------------+
|  Review Parsed Bill (D-Mart - Magarpatta)                         |
|  Review 6 items before generating Bachat pitch                     |
+-------------------------------------------------------------------+
|  [✓] Fortune Sunflower Oil 500ml              ₹85.00  [Edit]     |
|  [✓] Aashirvaad Atta 5kg                      ₹260.00 [Edit]     |
|  [!] Unknown Item (Unclear Text)              ₹45.00  [Fix / ✕]  |
|  [✓] Men Cotton T-Shirt                       ₹299.00 [Edit]     |
+-------------------------------------------------------------------+
|  [ + Add Missing Item ]         [ Generate Comparison Pitch -> ] |
+-------------------------------------------------------------------+


4. Product Logic & Edge-Case Rules

4.1. Unit-Price Normalization Algorithm

$$\text{Just Equivalent Price} = \left( \frac{\text{Just Pack Price}}{\text{Just Pack Quantity}} \right) \times \text{Scanned Receipt Item Quantity}$$

4.2. Edge-Case Matrix

Edge CaseProcessing LogicHinglish Display LabelMath ImpactMatched (Just Cheaper)Normalizes unit rate and compares cost.Aapne Bachaye ₹XX (D-Mart Se Sasta!)Added to Net Savings.Matched (Mart Cheaper)Item remains in comparison pool.D-Mart Pe ₹XX Sasta HaiDeducted from Net Savings.Out-of-Scope CategoryBypasses non-groceries (Apparel, Fresh Veg, Electronics, Toys).Yeh Category Just Pe Available Nahi HaiExcluded from calculations.Unmatched Grocery SKUGrocery item not yet produced in Just catalog.Abhi Just Catalog Mein Available NahiExcluded from calculations.Blurry/Unreadable LineFlagged during verification step for agent fix.Unclear Item (Agent Verified)Ignored if uncorrected.

5. UI/UX Wireframes & Hinglish Visual Identity

Branding Guidelines

Palette: Terracotta Red (#A82308), Lime Green (#449E2B), Bright Yellow (#FFD200), Off-White (#F9F9F6).

Tone: High-energy, encouraging, and clear Hinglish.

Screen 1: Receipt Capture & Upload Screen

Header: Deep Red banner reading "Just Bill Bachat Scanner".

Primary Action: Large Lime Green button reading "D-Mart Bill Scan Karein" with camera icon.

Secondary Action: Secondary border button reading "Gallery Se Bill Upload Karein".

Screen 2: Final Savings Pitch Dashboard

Plaintext

+-------------------------------------------------------------------+
| JUST MAGARPATTA / HADAPSAR                                        |
+-------------------------------------------------------------------+
|  AAPKI TOTAL BACHAT WITH JUST                                     |
|  ₹115.00                                            [ 22% OFF ]   |
|  Is Bill Par Direct Savings                                       |
|-------------------------------------------------------------------|
|  Scanned Bill Total (Matched Items): ₹373.00                      |
|  Just App Equivalent Price:          ₹258.00                      |
+-------------------------------------------------------------------+
|  ITEM BREAKDOWN (6 ITEMS SCANNED)                                 |
|                                                                   |
|  D-MART: Fortune Sunflower Oil (500 ml)                  ₹85.00   |
|  JUST:   Just Pure Sunflower Oil (Equal 500 ml)          ₹70.00   |
|  [ GREEN TAG: Aapne Bachaye ₹15.00 (D-Mart Se Sasta!) ]           |
|                                                                   |
|  D-MART: Tata Salt (1 kg)                                ₹28.00   |
|  JUST:   Just Iodized Salt (1 kg)                        ₹30.00   |
|  [ AMBER TAG: D-Mart Pe ₹2.00 Sasta Hai ]                         |
|                                                                   |
|  D-MART: Men Cotton T-Shirt (1 Unit)                    ₹299.00   |
|  [ GREY TAG: Yeh Category Just Pe Available Nahi Hai ]            |
+-------------------------------------------------------------------+
| [ CTA: Install Just App & Claim Savings (Generates QR Code) ]     |
+-------------------------------------------------------------------+


6. Technical Stack & Updated Code Prompt

For rapid prototyping with OCR capability on Claude or Cursor, use this updated prompt:




Plaintext

Build a responsive React (TypeScript) app with Tailwind CSS and Lucide React icons for "Just" (Swiggy Instamart private label).

Features:
1. File Upload / Camera Trigger: Include an interactive receipt upload screen allowing image input, showing a simulated OCR loading state ("Bill scan ho raha hai...").
2. Verification Step: Provide a quick modal to edit parsed receipt item name, price, and quantity before generating pitch.
3. Color Scheme: Deep Terracotta Red (#A82308), Bright Lime Green (#449E2B), Accent Yellow (#FFD200).
4. Logic & Edge Cases: Perform unit-price normalization between scanned mart quantities and Just pack sizes. Handle non-grocery categories with grey Hinglish tags ("Category Not Available"), items cheaper at other marts with amber tags ("D-Mart Pe Sasta"), and savings with green tags.
5. Micro-copy: Entire UI in conversion-focused Hinglish.


Would you like to build a quick backend endpoint for real-time OCR parsing using AWS Textract or Google Cloud Vision, or explore frontend-only OCR using Tesseract.js?

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/83a67ef3-71e2-4950-b174-b5b7c15e3ba3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
