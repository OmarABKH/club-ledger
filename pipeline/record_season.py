# DATA=seasons.json record_season.py slug season league units '{...}'
# Stores one club's figures for one season (in £'000) in seasons.json, after checking that
# the revenue lines add up, the bridge reconciles to pre-tax, and — for 2023/24 — that the
# figures match the comparatives already taken from the club's 2024/25 accounts.
import json, sys, os
slug, season, league, units, raw = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], json.loads(sys.argv[5])
k = 1000 if units == "pounds" else 1
fig = {key: (round(v / k) if isinstance(v, (int, float)) and key not in ("months",) else v) for key, v in raw.items()}
if isinstance(fig.get("prior"), dict):
    fig["prior"] = {pk: round(pv / k) for pk, pv in fig["prior"].items()}
fig["league"] = league
# Seasons without full figures: "partial" (some figures published, e.g. revenue and pre-tax only),
# "none" (accounts filed without an income statement) or "notFiled" (no accounts for the season).
# They need a reason, which the site shows; any figure not given is stored as not published.
if fig.get("available", "full") != "full":
    assert fig["available"] in ("partial", "none", "notFiled"), fig["available"]
    assert fig.get("gapReason"), "say why the figures are missing (gapReason)"
    if fig["available"] != "partial":
        assert not any(k in fig for k in ("revenue", "staffCosts", "preTax")), "no figures for this season"
    DATA = os.environ.get("DATA", "seasons.json")
    data = json.load(open(DATA)) if os.path.exists(DATA) else {}
    data.setdefault(slug, {})[season] = fig
    json.dump(data, open(DATA, "w"), indent=1)
    print(f"ok {slug} {season}: {fig['available']} ({', '.join(k for k in ('revenue', 'staffCosts', 'preTax') if k in fig) or 'no figures'})")
    sys.exit()
# Other costs can be given directly or derived from the accounts' total operating costs.
if "opexTotal" in fig:
    fig["otherOpCosts"] = fig.pop("opexTotal") - fig["staffCosts"] - fig["amortisation"]
mix = fig["matchday"] + fig["broadcasting"] + fig["commercial"]
assert abs(mix - fig["revenue"]) <= 2, f"revenue lines {mix} != total {fig['revenue']}"
bridge = fig["revenue"] - fig["staffCosts"] - fig["amortisation"] - fig["otherOpCosts"] + fig["playerSales"] + fig.pop("check")
assert abs(bridge - fig["preTax"]) <= 3, f"bridge {bridge} != pre-tax {fig['preTax']}"

DATA = os.environ.get("DATA", "seasons.json")
data = json.load(open(DATA)) if os.path.exists(DATA) else {}
# The 2024/25 record may carry the prior-year comparatives from the same accounts ("prior");
# the Championship's live in the older figures.json.
prior = (data.get(slug, {}).get("2024/25", {}).get("prior")
         or (json.load(open("figures.json")).get(slug, {}).get("prior") if os.path.exists("figures.json") else None))
if season == "2023/24" and prior:
    diffs = []
    for key in ("revenue", "staffCosts", "preTax"):
        if abs(prior[key] - fig[key]) > 2:
            diffs.append(f"{key}: first reported {fig[key]}, restated {prior[key]}")
    if diffs:
        print("RESTATED in 2024/25 accounts ->", "; ".join(diffs))
        fig.setdefault("notes", []).append("Some of these figures were restated in the following year's accounts; the site shows them as first reported.")

data.setdefault(slug, {})[season] = fig
json.dump(data, open(DATA, "w"), indent=1)
n = sum(len(v) for v in data.values())
print(f"ok {slug} {season}: revenue {fig['revenue']}, wages/revenue {fig['staffCosts']/fig['revenue']:.0%}, pre-tax {fig['preTax']}  ({n} club-seasons)")
