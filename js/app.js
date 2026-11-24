// Builds the page from data/clubs.js. All money figures in the data are £'000, as reported.
// League and season pickers scope every view; club pages also show all three seasons side by side.
(function () {
  "use strict";

  const { barChart } = window.Charts;
  const DATA = window.CLUB_DATA;
  const SEASONS = DATA.seasons; // oldest first
  const LATEST = SEASONS[SEASONS.length - 1];

  const LEAGUES = { PL: "Premier League", CH: "Championship", L1: "League One", L2: "League Two", NL: "National League" };
  const LEAGUE_SHORT = { PL: "PL", CH: "Champ", L1: "L1", L2: "L2", NL: "NL" };
  const STREAMS = {
    matchday: { label: "Matchday", color: "var(--series-1)" },
    broadcasting: { label: "Broadcasting", color: "var(--series-2)" },
    commercial: { label: "Commercial & other", color: "var(--series-3)" },
  };

  // ---------- Formatting ----------

  // Figures a club didn't publish are null: they show as a dash and are left out of charts and totals.
  const has = (v) => v !== null && v !== undefined;
  const NP = "—";
  const m = (k) => {
    if (!has(k)) return NP;
    const v = Math.abs(k) / 1000;
    const sign = k < 0 ? "−" : "";
    if (v >= 1000) return `${sign}£${(v / 1000).toFixed(2)}bn`;
    return `${sign}£${v >= 100 ? v.toFixed(0) : v.toFixed(1)}m`;
  };
  // Keep a decimal near 100% so a club just over the line doesn't read as exactly 100%.
  const pct = (r) => {
    if (!has(r)) return NP;
    const v = r * 100;
    return Math.round(v) === 100 && Math.abs(v - 100) > 0.05 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
  };
  const signedPct = (r) => (r === null ? "–" : `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(Math.round(r * 100))}%`);
  const yearEnd = (iso) => (!iso ? NP : new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }));
  const longDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const period = (s) => (s.months === 12 ? "year" : `${s.months} months`);
  const $ = (id) => document.getElementById(id);
  const names = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list.join(""));
  // "Not published: A and B (each club's page says why)."
  const missingNote = (missing) => (missing.length ? `Not published: ${names(missing.map((c) => c.name))} (each club's page says why).` : "");

  // ---------- Data for the chosen season ----------

  // One record per club for a season, with the derived figures the views need.
  function clubSeason(club, season) {
    const s = club.seasons[season];
    const i = SEASONS.indexOf(season);
    const prev = i > 0 ? club.seasons[SEASONS[i - 1]] : null;
    const full = s.available === "full";
    const operating = full ? s.revenue - s.staffCosts - s.amortisation - s.otherOpCosts + s.playerSales : null;
    return {
      ...s,
      slug: club.slug,
      name: club.name,
      club,
      season,
      prev,
      full,
      wageRatio: has(s.staffCosts) && has(s.revenue) ? s.staffCosts / s.revenue : null,
      revenueChange: prev && has(prev.revenue) && has(s.revenue) ? s.revenue / prev.revenue - 1 : null,
      otherItems: full ? s.preTax - operating : null, // other income, interest and one-offs: the balancing figure
      threeYear: SEASONS.every((y) => has(club.seasons[y].preTax)) ? SEASONS.reduce((sum, y) => sum + club.seasons[y].preTax, 0) : null,
    };
  }

  const remembered = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  };
  const remember = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  };

  let season = SEASONS.includes(remembered("clubLedger.season")) ? remembered("clubLedger.season") : LATEST;
  let league = DATA.leagues.find((l) => l.id === remembered("clubLedger.league")) || DATA.leagues[0];
  let clubs = [];
  const loadSeason = () => (clubs = league.clubs.map((c) => clubSeason(c, season)));
  // Clubs that published a given figure this season.
  const withFigure = (key) => clubs.filter((c) => has(c[key]));
  const across = (n) => (n === clubs.length ? `all ${n} clubs` : `the ${n} of ${clubs.length} clubs that publish it`);
  const leagueOfClub = (slug) => DATA.leagues.find((l) => l.clubs.some((c) => c.slug === slug));

  // ---------- Headline tiles and highlights ----------

  function renderTiles() {
    const withWages = withFigure("wageRatio");
    const withRevenue = withFigure("revenue");
    const withResult = withFigure("preTax");
    const overWages = withWages.filter((c) => c.wageRatio > 1).length;
    const revenue = withRevenue.reduce((s, c) => s + c.revenue, 0);
    const preTax = withResult.reduce((s, c) => s + c.preTax, 0);
    const lossMakers = withResult.filter((c) => c.preTax < 0).length;
    $("tiles").innerHTML = `
      <div class="tile hero"><div class="label">Clubs that spent more on wages than they earned</div>
        <div class="value">${overWages} of ${withWages.length}</div>
        <div class="sub">Staff costs above 100% of revenue in ${season}${withWages.length < clubs.length ? `; ${clubs.length - withWages.length} clubs don't publish their wages` : ""}</div></div>
      <div class="tile"><div class="label">Combined revenue</div><div class="value">${m(revenue)}</div>
        <div class="sub">Across ${across(withRevenue.length)} in ${season}</div></div>
      <div class="tile"><div class="label">Combined result before tax</div><div class="value">${m(preTax)}</div>
        <div class="sub">${lossMakers} of ${withResult.length} clubs made a loss${withResult.length < clubs.length ? `; ${clubs.length - withResult.length} don't publish a result` : ""}</div></div>`;
  }

  function renderHighlights() {
    const byWage = withFigure("wageRatio").sort((a, b) => b.wageRatio - a.wageRatio);
    const byLoss = withFigure("preTax").sort((a, b) => a.preTax - b.preTax);
    const byRevenue = withFigure("revenue").sort((a, b) => b.revenue - a.revenue);
    const profitable = byLoss.filter((c) => c.preTax >= 0);
    const total = byRevenue.reduce((s, c) => s + c.revenue, 0);
    const share = (list) => Math.round((list.reduce((s, c) => s + c.revenue, 0) / total) * 100);
    const fromPL = byRevenue.filter((c) => c.league === "PL");
    const sales = withFigure("playerSales").reduce((s, c) => s + c.playerSales, 0);
    const some = (n) => (n === clubs.length ? `all ${n}` : `${n}`);
    const list = (items, value) =>
      `<ol class="mini">${items.map((c) => `<li><a href="#${c.slug}">${c.name}</a><span>${value(c)}</span></li>`).join("")}</ol>`;
    const cards = [
      {
        view: "wages", title: "Wages",
        text: `${byWage.filter((c) => c.wageRatio > 1).length} clubs spent more on staff than their entire revenue. The highest:`,
        body: list(byWage.slice(0, 3), (c) => pct(c.wageRatio)),
        cta: `Wage ratios for ${some(byWage.length)} clubs`,
      },
      {
        view: "revenue", title: "Revenue",
        text:
          league.id === "premier-league"
            ? `The six biggest earners brought in ${share(byRevenue.slice(0, 6))}% of the ${byRevenue.length} clubs' combined revenue in ${season}. The top three:`
            : fromPL.length === 0
              ? `The three biggest earners brought in ${share(byRevenue.slice(0, 3))}% of the ${byRevenue.length} clubs' combined revenue in ${season}:`
              : fromPL.length === 1
                ? `${fromPL[0].name}, in the Premier League in ${season}, brought in ${share(fromPL)}% of the ${byRevenue.length} clubs' combined revenue. The biggest earners:`
                : `The ${fromPL.length} clubs that were in the Premier League in ${season} brought in ${share(fromPL)}% of the ${byRevenue.length} clubs' combined revenue. The biggest earners:`,
        body: list(byRevenue.slice(0, 3), (c) => m(c.revenue)),
        cta: "Revenue sources for every club",
      },
      {
        view: "results", title: "Profit & loss",
        text: `${profitable.length === 0 ? "No club" : `Only ${profitable.length} ${profitable.length === 1 ? "club" : "clubs"}`} made a profit, even with ${m(sales)} of profit from selling players. The biggest losses:`,
        body: list(byLoss.slice(0, 3), (c) => m(c.preTax)),
        cta: `Results for ${some(byLoss.length)} clubs`,
      },
    ];
    $("highlights").innerHTML = cards
      .map((h) => `<article class="card highlight"><h2>${h.title}</h2><p>${h.text}</p>${h.body}<a class="more" href="#${h.view}">${h.cta} →</a></article>`)
      .join("");
  }

  // ---------- Charts ----------

  const tag = (c) => LEAGUE_SHORT[c.league];

  function wageChart() {
    const rows = withFigure("wageRatio")
      .sort((a, b) => b.wageRatio - a.wageRatio)
      .map((c) => ({ id: c.slug, label: c.name, tag: tag(c), club: c, segments: [{ key: "ratio", value: c.wageRatio * 100 }] }));
    $("wages-footnote").textContent = missingNote(clubs.filter((c) => !has(c.wageRatio)));
    barChart($("chart-wages"), rows, { ratio: { label: "Wages / revenue", color: "var(--series-1)" } }, {
      ariaLabel: `Staff costs as a percentage of revenue, by club, ${season}`,
      format: (v) => pct(v / 100),
      tickFormat: (v) => `${v}%`,
      reference: { value: 100 },
      tooltip: (r) => ({
        title: `${r.club.name} · ${LEAGUES[r.club.league]} in ${season}`,
        rows: [
          { value: pct(r.club.wageRatio), label: "of revenue spent on staff" },
          { value: m(r.club.staffCosts), label: "staff costs" },
          { value: m(r.club.revenue), label: "revenue" },
        ],
      }),
      onSelect: (r) => goToClub(r.club.slug),
    });
  }

  let mixMode = "money";
  function mixChart() {
    const rows = clubs
      .filter((c) => c.mixSplit && has(c.matchday))
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => {
        const scale = mixMode === "share" ? 100 / c.revenue : 1 / 1000;
        return {
          id: c.slug, label: c.name, tag: tag(c), club: c,
          segments: Object.keys(STREAMS).map((key) => ({ key, value: c[key] * scale })),
        };
      });
    barChart($("chart-mix"), rows, STREAMS, {
      ariaLabel: `Revenue by source, by club, ${season}`,
      format: (v) => (mixMode === "share" ? "" : `£${v.toFixed(0)}m`),
      tickFormat: (v) => (mixMode === "share" ? `${v}%` : `£${v}m`),
      tooltip: (r) => ({
        title: `${r.club.name} · revenue ${m(r.club.revenue)}`,
        rows: Object.entries(STREAMS).map(([key, s]) => ({
          color: s.color,
          value: `${m(r.club[key])} (${pct(r.club[key] / r.club.revenue)})`,
          label: s.label,
        })),
      }),
      onSelect: (r) => goToClub(r.club.slug),
    });
    const unsplit = clubs.filter((c) => !c.mixSplit && has(c.matchday)).map((c) => c.name);
    $("mix-footnote").textContent = [
      unsplit.length ? `Not shown: ${names(unsplit)}. ${unsplit.length === 1 ? "Its accounts don't" : "Their accounts don't"} split revenue into these three sources.` : "",
      missingNote(clubs.filter((c) => !has(c.matchday))),
    ].join(" ").trim();
  }

  let resultMode = "season";
  function resultChart() {
    const three = resultMode === "three";
    const value = (c) => (three ? c.threeYear : c.preTax);
    const rows = clubs
      .filter((c) => has(value(c)))
      .sort((a, b) => value(b) - value(a))
      .map((c) => ({ id: c.slug, label: c.name, tag: three ? "" : tag(c), club: c, segments: [{ key: "result", value: value(c) / 1000 }] }));
    barChart($("chart-result"), rows, {}, {
      ariaLabel: three ? `Combined result before tax over ${SEASONS[0]} to ${LATEST}, by club` : `Profit or loss before tax, by club, ${season}`,
      format: (v) => m(v * 1000),
      tickFormat: (v) => `${v < 0 ? "−" : ""}£${Math.abs(v)}m`,
      colorFor: (row, seg) => (seg.value < 0 ? "var(--loss)" : "var(--gain)"),
      tooltip: (r) =>
        three
          ? {
              title: `${r.club.name} · ${SEASONS[0]} to ${LATEST}`,
              rows: [
                ...SEASONS.map((y) => ({ value: m(r.club.club.seasons[y].preTax), label: `${y} (${LEAGUES[r.club.club.seasons[y].league]})` })),
                { value: m(r.club.threeYear), label: "combined" },
              ],
            }
          : {
              title: r.club.name,
              rows: [
                { value: m(r.club.preTax), label: r.club.preTax < 0 ? "loss before tax" : "profit before tax" },
                { value: m(r.club.playerSales), label: "profit on player sales" },
              ],
            },
      onSelect: (r) => goToClub(r.club.slug),
    });
    $("result-lede").textContent = three
      ? `Each club's results before tax for ${SEASONS.join(", ")} added together. Both the Premier League and the EFL judge clubs' losses over three seasons, so this is closer to how the leagues look at them, though clubs can deduct some spending (academy, women's football, infrastructure) that the accounts don't show separately.`
      : "Includes profits from selling players, which is how many clubs close the gap between what they earn and what they spend.";
    const missing = clubs.filter((c) => !has(value(c)));
    $("result-footnote").textContent = three && missing.some((c) => has(c.preTax))
      ? `Not shown: ${names(missing.map((c) => c.name))}, which ${missing.length === 1 ? "doesn't" : "don't"} have published results for all three seasons.`
      : missingNote(missing);
  }

  // ---------- Table ----------

  const COLUMNS = [
    { key: "name", label: "Club", get: (c) => c.name, html: (c) => `<a class="club-link" href="#${c.slug}">${c.name}</a>` },
    { key: "league", label: "League", get: (c) => c.league, html: (c) => LEAGUES[c.league] },
    { key: "yearEnd", label: "Year end", get: (c) => c.yearEnd, html: (c) => (c.yearEnd ? yearEnd(c.yearEnd) + (c.months === 12 ? "" : ` <span class="muted">(${c.months}m)</span>`) : "Not filed") },
    { key: "revenue", label: "Revenue", get: (c) => c.revenue, html: (c) => m(c.revenue) },
    { key: "revenueChange", label: "vs prior year", get: (c) => c.revenueChange ?? -Infinity, html: (c) => signedPct(c.revenueChange) },
    { key: "staffCosts", label: "Staff costs", get: (c) => c.staffCosts, html: (c) => m(c.staffCosts) },
    { key: "wageRatio", label: "Wages / revenue", get: (c) => c.wageRatio, html: (c) => pct(c.wageRatio) },
    { key: "playerSales", label: "Player sales profit", get: (c) => c.playerSales, html: (c) => m(c.playerSales) },
    { key: "preTax", label: "Result before tax", get: (c) => c.preTax, html: (c) => `<span class="${c.preTax < 0 ? "neg" : ""}">${m(c.preTax)}</span>` },
  ];
  let sort = { key: "wageRatio", dir: -1 };

  function renderTable() {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const rows = [...clubs].sort((a, b) => {
      const x = col.get(a);
      const y = col.get(b);
      if (!has(x) || !has(y)) return has(x) ? -1 : has(y) ? 1 : 0;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
    });
    $("table").innerHTML = `
      <thead><tr>${COLUMNS.map(
        (c) => `<th scope="col" ${c.key === sort.key ? `aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-sort="${c.key}">${c.key === "league" ? `${season} league` : c.label}</button></th>`
      ).join("")}</tr></thead>
      <tbody>${rows.map((c) => `<tr data-club="${c.slug}">${COLUMNS.map((col) => `<td>${col.html(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    $("table-footnote").textContent = clubs.some((c) => !c.full) ? `${NP} not published. Some clubs file small-company accounts that leave out the income statement or most of it; each club's page says what is missing.` : "";
  }

  // ---------- Club page ----------

  function delta(now, before) {
    if (!has(now) || !has(before)) return "";
    const diff = now - before;
    return `<div class="delta">${diff >= 0 ? "+" : "−"}${m(Math.abs(diff))} vs ${m(before)} the year before</div>`;
  }

  const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
  // dir -1: rank from the highest value down; dir 1: from the lowest up (e.g. biggest loss first).
  const rankOf = (c, key, dir = -1) => withFigure(key).sort((a, b) => (dir < 0 ? b[key] - a[key] : a[key] - b[key])).findIndex((x) => x.slug === c.slug) + 1;

  function threeSeasons(c) {
    const cols = SEASONS.map((y) => clubSeason(c.club, y));
    const row = (label, cell) => `<tr><td>${label}</td>${cols.map((s) => `<td class="${s.season === season ? "current" : ""}">${cell(s)}</td>`).join("")}</tr>`;
    return `
      <div class="card">
        <h2>Three seasons</h2>
        <div class="table-scroll"><table class="data trend"><thead><tr><th scope="col"></th>${cols
          .map((s) => `<th scope="col" class="${s.season === season ? "current" : ""}">${s.season}</th>`)
          .join("")}</tr></thead><tbody>
          ${row("League", (s) => `<abbr title="${LEAGUES[s.league]}">${LEAGUE_SHORT[s.league]}</abbr>`)}
          ${row("Revenue", (s) => m(s.revenue))}
          ${row("Staff costs", (s) => m(s.staffCosts))}
          ${row("Wages / revenue", (s) => pct(s.wageRatio))}
          ${row("Player sales profit", (s) => m(s.playerSales))}
          ${row("Result before tax", (s) => `<span class="${s.preTax < 0 ? "neg" : ""}">${m(s.preTax)}</span>`)}
          ${row("Period", (s) => (s.yearEnd ? `${s.months === 12 ? "" : `${s.months}m to `}${yearEnd(s.yearEnd)}` : "Not filed"))}
        </tbody></table></div>
        <p class="footnote">${has(c.threeYear)
          ? `Combined result before tax over the three seasons: <b class="${c.threeYear < 0 ? "neg" : ""}">${m(c.threeYear)}</b>.`
          : `${NP} not published.`}</p>
      </div>`;
  }

  function renderClub(c) {
    const p = c.prev || {};
    const bridge = [
      ["Revenue", c.revenue],
      ["Staff costs", -c.staffCosts],
      ["Other operating costs", -c.otherOpCosts],
      ["Player amortisation", -c.amortisation],
      ["Profit on player sales", c.playerSales],
      ["Other income, interest & one-offs", c.otherItems],
    ];
    // "Highest wage ratio", "4th-highest revenue", "Biggest loss"…
    const rankText = (n, word, what) => (n === 1 ? `${word[0].toUpperCase()}${word.slice(1)} ${what}` : `${ordinal(n)}-${word} ${what}`);
    // Each rank is among the clubs that published that figure.
    const ranks = [
      has(c.wageRatio) && [rankText(rankOf(c, "wageRatio"), "highest", "wage ratio"), withFigure("wageRatio").length],
      has(c.revenue) && [rankText(rankOf(c, "revenue"), "highest", "revenue"), withFigure("revenue").length],
      has(c.preTax) && [c.preTax < 0 ? rankText(rankOf(c, "preTax", 1), "biggest", "loss") : rankText(rankOf(c, "preTax"), "best", "result"), withFigure("preTax").length],
    ].filter(Boolean);
    const gapTitle = { partial: "Only some figures published", none: "No income statement published", notFiled: "No accounts filed" }[c.available];
    const pageList = [["income statement", "pnl"], ["revenue note", "revenue"], ["staff costs", "staff"]]
      .filter(([, k]) => c.pages && c.pages[k])
      .map(([label, k]) => `${label} p.${c.pages[k]}`)
      .join(", ");
    const mixRows = c.mixSplit
      ? Object.entries(STREAMS)
      : [
          ["matchday", { label: c.mixLabels ? c.mixLabels.matchday : "Football (tickets and league income combined)", color: "var(--muted)" }],
          ["commercial", { ...STREAMS.commercial, label: c.mixLabels ? c.mixLabels.commercial : STREAMS.commercial.label }],
        ];
    const source = c.comparative
      ? `the comparative figures in its accounts for the following year (to ${longDate(c.club.seasons[SEASONS[SEASONS.indexOf(c.season) + 1]].yearEnd)})`
      : `its accounts for the ${period(c)} to ${longDate(c.yearEnd)}`;
    $("club-body").innerHTML = `
      ${gapTitle ? `<div class="card gap"><h2>${gapTitle}</h2><p>${c.gapReason}</p></div>` : ""}

      ${ranks.length ? `<div class="ranks">${ranks.map(([r, n]) => `<span class="chip"><b>${r}</b> of the ${n} in ${season}</span>`).join("")}</div>` : ""}

      ${has(c.revenue) || has(c.preTax) ? `<div class="kv">
        <div><div class="label">Revenue</div><div class="value">${m(c.revenue)}</div>${delta(c.revenue, p.revenue)}</div>
        <div><div class="label">Staff costs</div><div class="value">${m(c.staffCosts)}</div>${delta(c.staffCosts, p.staffCosts)}</div>
        <div><div class="label">Wages / revenue</div><div class="value">${pct(c.wageRatio)}</div>
          ${p.revenue && p.staffCosts ? `<div class="delta">${pct(p.staffCosts / p.revenue)} the year before</div>` : ""}</div>
        <div><div class="label">Result before tax</div><div class="value">${m(c.preTax)}</div>${delta(c.preTax, p.preTax)}</div>
        <div><div class="label">Profit on player sales</div><div class="value">${m(c.playerSales)}</div></div>
        <div><div class="label">Player amortisation</div><div class="value">${m(c.amortisation)}</div></div>
      </div>` : ""}

      ${threeSeasons(c)}

      ${c.full ? `<div class="club-grid">
        <div class="card">
          <h2>Where the revenue came from</h2>
          <table class="data"><tbody>
            ${mixRows
              .map(([k, s]) => `<tr><td><span class="swatch" style="background:${s.color}"></span>${s.label}</td><td>${m(c[k])}</td><td class="muted">${pct(c[k] / c.revenue)}</td></tr>`)
              .join("")}
          </tbody></table>
        </div>
        <div class="card">
          <h2>From revenue to ${c.preTax < 0 ? "loss" : "profit"}</h2>
          <table class="data"><tbody>
            ${bridge.map(([label, v]) => `<tr><td>${label}</td><td class="${v < 0 ? "neg" : ""}">${v < 0 ? "−" : "+"}${m(Math.abs(v))}</td></tr>`).join("")}
            <tr class="total"><td>Result before tax</td><td class="${c.preTax < 0 ? "neg" : ""}">${m(c.preTax)}</td></tr>
          </tbody></table>
        </div>
      </div>` : ""}

      ${c.notes && c.notes.length ? `<div class="card"><h2>Notes for ${season}</h2><ul class="notes">${c.notes.map((n) => `<li>${n}</li>`).join("")}</ul></div>` : ""}

      <div class="card">
        <h2>Source</h2>
        ${c.sourceUrl
          ? `<p class="source">${c.companyName} (company ${c.companyNumber}): ${c.accountsType.toLowerCase()} accounts, using ${source}.
          <a href="${c.sourceUrl}" target="_blank" rel="noopener">Open the filing</a>${pageList ? ` (${pageList})` : ""}.</p>`
          : `<p class="source">${c.companyName} (company ${c.companyNumber}) has not filed accounts for this season.
          <a href="https://find-and-update.company-information.service.gov.uk/company/${c.companyNumber}/filing-history" target="_blank" rel="noopener">See its filing history</a>.</p>`}
      </div>`;
    $("club-title").textContent = c.name;
    $("club-meta").textContent = `${season} · ${LEAGUES[c.league]} · ${c.yearEnd ? `${c.months === 12 ? "year" : `${c.months} months`} to ${yearEnd(c.yearEnd)}` : "no accounts filed"}`;
    $("club-select").value = c.slug;
  }

  // ---------- Views ----------

  const VIEWS = ["overview", "wages", "revenue", "results", "clubs", "method"];

  function goToClub(slug) {
    location.hash = slug;
  }

  function setLeague(next) {
    if (next === league) return;
    league = next;
    remember("clubLedger.league", league.id);
    $("league-select").value = league.id;
    fillClubSelect();
    renderSeason();
  }

  function showView() {
    let token = location.hash.slice(1);
    const linkedLeague = DATA.leagues.find((l) => l.id === token) || leagueOfClub(token);
    if (linkedLeague) setLeague(linkedLeague);
    if (DATA.leagues.some((l) => l.id === token)) token = "overview";
    const club = clubs.find((c) => c.slug === token);
    const view = club ? "club" : VIEWS.includes(token) ? token : "overview";
    document.querySelectorAll("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== view));
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const current = a.dataset.nav === view || (view === "club" && a.dataset.nav === "clubs");
      if (current) {
        a.setAttribute("aria-current", "page");
        // On phones the menu scrolls sideways: keep the current section visible in it.
        const tabs = a.parentElement;
        tabs.scrollLeft = Math.max(0, a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2);
      } else a.removeAttribute("aria-current");
    });
    if (club) renderClub(club);
    window.Charts.hideTip();
    window.scrollTo(0, 0);
  }

  // Everything that depends on the chosen season.
  function renderSeason() {
    loadSeason();
    document.querySelectorAll("[data-season-label]").forEach((el) => (el.textContent = season));
    // "the Premier League", "the Championship", but just "League One".
    document.querySelectorAll("[data-league-label]").forEach((el) => (el.textContent = league.name.startsWith("League ") ? league.name : `the ${league.name}`));
    $("league-season").textContent = `${league.name} ${league.season}`;
    renderTiles();
    renderHighlights();
    wageChart();
    mixChart();
    resultChart();
    renderTable();
    const token = location.hash.slice(1);
    const club = clubs.find((c) => c.slug === token);
    if (club) renderClub(club);
  }

  // ---------- Events ----------

  document.addEventListener("click", (e) => {
    const sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      const key = sortBtn.dataset.sort;
      sort = { key, dir: sort.key === key ? -sort.dir : key === "name" || key === "league" ? 1 : -1 };
      renderTable();
      return;
    }
    const row = e.target.closest("tr[data-club]");
    if (row && !e.target.closest("a")) goToClub(row.dataset.club);
  });
  function fillClubSelect() {
    $("club-select").innerHTML = [...league.clubs].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.slug}">${c.name}</option>`).join("");
  }
  fillClubSelect();
  $("league-select").innerHTML = DATA.leagues.map((l) => `<option value="${l.id}">${l.name}</option>`).join("");
  $("league-select").value = league.id;
  $("league-select").addEventListener("change", (e) => {
    setLeague(DATA.leagues.find((l) => l.id === e.target.value));
    location.hash = "overview";
  });
  $("club-select").addEventListener("change", (e) => goToClub(e.target.value));
  $("season-select").innerHTML = [...SEASONS].reverse().map((y) => `<option value="${y}">${y}</option>`).join("");
  $("season-select").value = season;
  $("season-select").addEventListener("change", (e) => {
    season = e.target.value;
    remember("clubLedger.season", season);
    renderSeason();
  });
  window.addEventListener("hashchange", showView);
  document.querySelectorAll("[data-mix]").forEach((btn) =>
    btn.addEventListener("click", () => {
      mixMode = btn.dataset.mix;
      document.querySelectorAll("[data-mix]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      mixChart();
    })
  );
  document.querySelectorAll("[data-result]").forEach((btn) =>
    btn.addEventListener("click", () => {
      resultMode = btn.dataset.result;
      document.querySelectorAll("[data-result]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      resultChart();
    })
  );

  $("legend-mix").innerHTML = Object.values(STREAMS).map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("");
  $("as-of").textContent = DATA.asOf;
  renderSeason();
  showView();
})();
