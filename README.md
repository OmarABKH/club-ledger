# Club Ledger

What each club in the 2026/27 Premier League (20 clubs) and EFL Championship (24 clubs) earned, spent on wages and lost over the last three seasons (2022/23 to 2024/25), taken from their annual accounts at Companies House. That's 132 club-seasons, every one reconciled to the reported result before tax.

- **Headline numbers:** how many clubs spent more on staff than they earned, plus combined revenue and losses
- **Wages as a share of revenue**, with the 100% line marked
- **Where the money comes from:** matchday, broadcasting, commercial & other (in £m or as % of revenue)
- **Profit or loss before tax**, including player sales
- **A full sortable table**, plus a page for each club with a step-by-step breakdown from revenue to profit or loss and a link to the exact pages in the original filing

Each section has its own link: `#wages`, `#revenue`, `#results`, `#clubs`, `#method`; each league too (`#premier-league`, `#championship`); and every club (for example `#arsenal` or `#cardiff`, which also switches to that club's league), so you can send someone straight to their club.

## Running it

Open `index.html` in a browser. No build step and no dependencies.

## Where the numbers come from

The pipeline in [pipeline/](pipeline/) turns filings into checked figures:

1. **`fetch.py`** finds each club's company on Companies House (from `clubs.tsv` / `clubs-pl.tsv`) and downloads its accounts for a given year (`YEAR=2025` or `YEAR=2024`). The 2025 accounts give 2024/25; the 2024 accounts give 2023/24 and, as comparatives, 2022/23.
2. **`ocr.swift`**: the filings are scanned images, so each page is run through macOS's built-in text recognition (Vision), rebuilding table rows from where the text sits on the page.
3. **`keypages.py`** pulls out the pages that matter: income statement, revenue note and staff costs note.
4. **`record_season.py`** stores one club's figures for one season (`DATA=seasons-pl.json` for the Premier League) and **refuses them unless they check out**:
   - the revenue lines must add up to total revenue;
   - revenue − staff costs − other costs − amortisation + player sales + other items must equal the reported result before tax.
   2023/24 figures are also compared with the comparatives in the following year's accounts, and restatements are flagged.
   Where the OCR text is garbled (sideways pages, blank tables), the figures are read from a rendered image of the page (`render.swift`) and still pass the same checks.
5. **`build_data.py`** combines everything into `data/clubs.js`, which the site loads.

To refresh next season: update `clubs.tsv`, run `python3 fetch.py`, OCR the PDFs (`swiftc -O ocr.swift -o ocr`, then `./ocr pdf/<club>.pdf > text/<club>.txt`), record each club with `record.py`, then run `build_data.py`. Downloaded PDFs and OCR text are not stored in the repository.

### Judgement calls

- **Which company:** the club's main operating company, except where the full picture is only in a parent's group accounts (e.g. Arsenal Holdings, Chelsea FC Holdings, Tottenham Hotspur Limited, NSWE UK for Aston Villa, QPR Holdings, Football Ventures (Whites) for Bolton). Each club's page names the company used.
- **Revenue categories:** clubs label revenue differently. Their lines are mapped to matchday, broadcasting and commercial & other; anything ambiguous goes into commercial & other, and individual calls are noted on the club's page.
- **Staff costs** include wages, social security and pensions, as reported in each staff costs note, plus termination payments some clubs show as exceptional (e.g. Manchester United, Tottenham).
- **Different periods:** most years end on 30 June; Cardiff, QPR, Stoke and West Ham use 31 May, Burnley 31 July. Wolves' accounts cover 13 months.
- **Not a PSR calculation:** allowable deductions (academy, women's football, community, infrastructure) aren't fully disclosed, so the site doesn't estimate whether clubs are within the EFL's spending limits.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The site (plain HTML/CSS/JS, SVG charts drawn by hand in `js/charts.js`) |
| `data/clubs.js` | Generated data for both leagues: all figures in £'000 as reported |
| `pipeline/` | Scripts and the checked source data (`filings*.json`, `seasons.json`, `seasons-pl.json`) |
