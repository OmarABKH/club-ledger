# Club Ledger

What each club in the 2026/27 Premier League (20 clubs), EFL Championship (24 clubs) and EFL League One (24 clubs) earned, spent on wages and lost over the last three seasons (2022/23 to 2024/25), taken from their annual accounts at Companies House. That's 204 club-seasons. Every one with full accounts (176) is reconciled to the reported result before tax; the rest are clubs that filed small-company accounts without a full income statement, or no accounts yet, and the site says so instead of guessing.

- **Headline numbers:** how many clubs spent more on staff than they earned, plus combined revenue and losses
- **Wages as a share of revenue**, with the 100% line marked
- **Where the money comes from:** matchday, broadcasting, commercial & other (in £m or as % of revenue)
- **Profit or loss before tax**, including player sales
- **A full sortable table**, plus a page for each club with a step-by-step breakdown from revenue to profit or loss and a link to the exact pages in the original filing

Each section has its own link: `#wages`, `#revenue`, `#results`, `#clubs`, `#method`; each league too (`#premier-league`, `#championship`, `#league-one`); and every club (for example `#arsenal` or `#cardiff`, which also switches to that club's league), so you can send someone straight to their club.

## Running it

Open `index.html` in a browser. No build step and no dependencies.

## Where the numbers come from

The pipeline in [pipeline/](pipeline/) turns filings into checked figures:

1. **`fetch.py`** finds each club's company on Companies House (from `clubs.tsv`, `clubs-pl.tsv` or `clubs-l1.tsv`, chosen with `CLUBS=`) and downloads its accounts for a given year (`YEAR=2025` or `YEAR=2024`). The 2025 accounts give 2024/25; the 2024 accounts give 2023/24 and, as comparatives, 2022/23.
2. **`ocr.swift`**: the filings are scanned images, so each page is run through macOS's built-in text recognition (Vision), rebuilding table rows from where the text sits on the page.
3. **`keypages.py`** pulls out the pages that matter: income statement, revenue note and staff costs note.
4. **`record_season.py`** stores one club's figures for one season (`DATA=seasons-pl.json` for the Premier League, `DATA=seasons-l1.json` for League One) and **refuses them unless they check out**:
   - the revenue lines must add up to total revenue;
   - revenue − staff costs − other costs − amortisation + player sales + other items must equal the reported result before tax.
   2023/24 figures are also compared with the comparatives in the following year's accounts, and restatements are flagged.
   Where the OCR text is garbled (sideways pages, blank tables), the figures are read from a rendered image of the page (`render.swift`) and still pass the same checks.
   Seasons without full figures are recorded with `"available": "partial"` (only some figures published, e.g. revenue and pre-tax), `"none"` (accounts without an income statement) or `"notFiled"`, plus a `gapReason` the site shows; figures not given are stored as not published (null).
5. **`build_data.py`** combines everything into `data/clubs.js`, which the site loads.

To refresh next season: update the club lists, run `fetch.py` for the new year, OCR the PDFs (`swiftc -O ocr.swift -o ocr`, then `./ocr pdf/<club>.pdf > text/<club>.txt`), record each club-season with `record_season.py`, then run `build_data.py`. Downloaded PDFs and OCR text are not stored in the repository.

### Judgement calls

- **Which company:** the club's main operating company, except where the full picture is only in a parent's group accounts (e.g. Arsenal Holdings, Chelsea FC Holdings, Tottenham Hotspur Limited, NSWE UK for Aston Villa, QPR Holdings, Football Ventures (Whites) for Bolton, and group accounts for Huddersfield, Leicester, Plymouth and Reading). Blackpool's figures are the club company's rather than its holding group's, which also runs a hotel. Each club's page names the company used.
- **Revenue categories:** clubs label revenue differently. Their lines are mapped to matchday, broadcasting and commercial & other; anything ambiguous goes into commercial & other, and individual calls are noted on the club's page.
- **Staff costs** include wages, social security and pensions, as reported in each staff costs note, plus termination payments some clubs show as exceptional (e.g. Manchester United, Tottenham).
- **Different periods:** most years end on 30 June; some clubs use 31 May (e.g. Arsenal, Liverpool, Cardiff, West Ham) or 31 July (Burnley, Sunderland). A few periods are 11 or 13 months because a club changed its year end (Aston Villa 2023/24, Wolves 2024/25, Barnsley 2023/24, Bristol City and Leicester 2022/23, Swansea 2023/24), and Mansfield's 2024/25 accounts cover 18 months; these are flagged on the site.
- **Clubs that don't publish everything:** small companies can leave the income statement out of their accounts. In League One, Doncaster, Mansfield, Notts County, Stevenage, Stockport and Wycombe publish no revenue, wages or results; Bradford City, Leyton Orient and Bromley publish revenue and the result before tax only. Sheffield Wednesday have filed nothing for 2024/25 (administration) and Bromley's next accounts cover 18 months to June 2026. These show as "not published" and are left out of charts and totals that need the missing figure. Bromley's January–December years are shown against the season most of the year falls in (calendar 2024 as 2023/24).
- **Revenue that isn't split three ways:** where a club reports, say, ticket and league income together, or only splits retail from everything else, it is left out of the revenue-mix chart and its own categories are shown on its page.
- **One-off gains:** some clubs booked large gains from selling assets to companies under the same owners (e.g. Chelsea's women's team and hotels, Newcastle's St James' Park leasehold improvements). They are included in the result before tax, as reported, and flagged on the club's page.
- **Not a PSR calculation:** allowable deductions (academy, women's football, community, infrastructure) aren't fully disclosed, so the site doesn't estimate whether clubs are within the Premier League's or EFL's spending limits.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The site (plain HTML/CSS/JS, SVG charts drawn by hand in `js/charts.js`) |
| `data/clubs.js` | Generated data for all three leagues: figures in £'000 as reported, null where not published |
| `pipeline/` | Scripts and the checked source data (`filings*.json`, `seasons.json`, `seasons-pl.json`, `seasons-l1.json`) |
