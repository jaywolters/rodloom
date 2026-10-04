# Rod Loom

A local browser workbench for designing banded fishing-rod thread wraps and paired spiral fade transitions.

## Open

Run `python server.py` in this folder and visit http://localhost:8000. Python 3 is sufficient; no packages or build required. The integrated catalog requires this server, not `python -m http.server`. Opening `index.html` directly still supports custom designs, but not the retailer catalog.

## Hosted deployment

The website is hosted on AWS Amplify with a Lambda/HTTP API catalog backend. See [DEPLOY.md](DEPLOY.md) for the live URL, GitHub connection step, and deployment instructions. Local Python development remains supported.

## Features

- Shaded rod and flat previews with individual turns
- Regular, metallic, and neon finishes per band
- Neon yellow and neon green planning swatches
- Searchable Fuji / ProWrap size D retailer catalog with product-photo swatches, codes, SKUs, and thread-line filters
- Band turn counts, drag reorder, mirror, reverse, and undo
- Two-thread spiral fade transitions with independent colors/finishes, direction, and finished paired-turn counts
- Clearly labeled 4× inspection mode for fine spiral detail
- Adjustable thread coverage and blank diameter
- Wrap dimensions, approximate thread consumption, and printable recipe
- Browser draft autosave and a named LocalStorage design library with save, open, and delete
- JSON import/export for backups and PNG export

## Important limitations

Catalog names, codes, SKUs, size D variants, photos, and stock flags come from Mud Hole's public Shopify product JSON, not a manufacturer API. Preview RGB colors are automatically approximated from product photos and may sample spool/label/shadow colors incorrectly; edit the swatch as needed and consult physical charts. Metallic reflections and neon saturation are illustrative. Finish, color preserver, the blank, and lighting affect actual results. Older saved planning bands remain marked unverified.

The Python server retrieves only six fixed product catalogs (ProWrap ColorFast/Nylon/Metallic and Fuji Ultra Poly/NOCP/Metallic), caching responses for 24 hours in `.catalog-cache/`. Thumbnails are proxied from the catalog's Shopify CDN links and cached on demand. Stale catalogs are retained when the source is unavailable; the UI flags degraded results. Stock is not real-time. Upstream endpoints can change without notice. Review retailer terms and obtain permission as needed before publishing or broadly redistributing catalog content. The local server binds to loopback only.

The initial size D coverage of 0.25 mm/turn is an editable estimate, not a universal specification. Measure the width of a test wrap and divide by its turn count. Metallic threads may pack differently; this version uses one coverage value for the whole design.

Thread usage estimates a helix around the blank plus one thread-width diameter allowance. It excludes tag ends, waste, guide feet, taper, and finish buildup. The preview uses the same pixels-per-mm scale on both axes, auto-fitting without distortion. Rod view includes approximate thread buildup (coverage used as thread thickness); flat view unrolls the circumference at the thread centerline. Individual turns are hidden when too small to resolve rather than exaggerated. PNG exports use the same geometry. Actual-size mode is the default. Calibrate the 50 mm reference line with a physical ruler using the pixels-per-mm field; the default is 3.25 CSS pixels/mm for your monitor. Display settings and the “At your bench” coverage/diameter controls are tucked into the collapsed “Display scale & calibration” section. Other monitors require calibration. Calibration stays in this browser and must be repeated after changing zoom or monitors. Larger previews scroll; extremely long wraps are clipped at a 4000 CSS-pixel canvas limit (use Fit to window to see the whole pattern). Fit mode and PNG exports preserve proportions but are not physical life-size. Print output is not calibrated. Mirror appends a full reversed copy, including the last band.

This version supports straight bands and tightly packed two-thread spirals, not open-pitch spirals, cross-wraps, diamonds, or weaving. Browser storage depends on browser permissions; download JSON for durable backups. Fonts use Google Fonts when online and fall back to local sans-serif fonts otherwise. Design data is not uploaded.

## Saved designs

Name your design and click **Save design** to store a snapshot in this browser's LocalStorage. Saving the same name asks before replacing it; use a different name to keep another version. Use **Saved designs** to open or delete snapshots. Editing and autosave update only the current draft, not saved snapshots. Browser storage is local to this browser and site and can be cleared; use **Export JSON** for durable backups or **Import JSON** to open a downloaded design.

## Spiral transitions

Following [Mud Hole's alternative fade technique](https://mudhole.com/blogs/tips-tricks/alternative-fade-wraps), click **Spiral into next color** underneath a solid band to insert a transition using it and the next solid band's colors. It defaults to five finished paired revolutions. Both colors are copied, so later edits to neighboring bands do not silently change the transition. You can edit each thread's color/finish, the second thread's name, turn count, and spiral direction.

At 0.25 mm coverage, two threads advance 0.50 mm per rod revolution; five paired revolutions cover 2.50 mm. They are side by side, not stacked. The recipe calls for one additional setup pair before backing off one turn of the outgoing color and securing it under the incoming color. Dimensions model the finished, burnished transition; actual tie-off geometry varies. Thread consumption includes both helices but excludes setup turns, tag ends, and waste. The total-revolution count also excludes setup turns.

The preview projects helices onto the visible half of the rod; Flat layout unwraps the whole circumference. Physical spiral angles are slight on a 15 mm blank—no artificial thickening or exaggerated slant is applied. **Inspect 4×** magnifies the calibrated view; click **Actual size** to return. Large views scroll. Reverse and Mirror swap a transition's thread order and reverse its spiral direction. Save/open, autosave, PNG export, printing, and Undo include spiral sections. Older solid-band designs still load.

## Search discovery and sharing

`index.html` includes a descriptive title, search description, canonical URL, indexing directives, Open Graph and Twitter sharing tags, and Schema.org WebSite/WebPage/WebApplication structured data. `robots.txt` advertises `sitemap.xml`; `favicon.svg` provides the site icon.

Production URLs assume **https://rodloom.com/**. If the domain changes, update the canonical and social URLs, structured-data URLs and IDs, sitemap URL, and robots sitemap directive together. Serve the site publicly over HTTPS, redirect HTTP and alternate hostnames to the canonical host, and ensure `/`, `/robots.txt`, `/sitemap.xml`, and `/favicon.svg` return successfully. The current Python server is local-only; metadata alone does not publish the site.

After launch, verify domain ownership in Google Search Console and Bing Webmaster Tools and submit `https://rodloom.com/sitemap.xml`. Validate structured data with Schema.org's validator and inspect the live URL in Search Console. A real, publicly hosted social preview image can be added later with `og:image` and `twitter:image` tags. Metadata supports discovery and accurate presentation; it does not guarantee indexing or higher rankings.

## Check

`node --check app.js`

`node --check catalog.js`

`node --test geometry.test.js`

`python -m py_compile server.py`
