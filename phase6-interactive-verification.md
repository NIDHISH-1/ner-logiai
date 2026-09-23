# Interactive Route Selection Verification

The Government Admin dashboard now exposes Origin and Destination selects plus `Calculate Safe Route`. The initial selection showed Guwahati → Imphal with shortest-route comparison, safety rejection, risk, confidence, distance, ETA, reason, rejected edge, and compact admin cost breakdown.

The live destination was changed to Shillong and calculated. The panel refreshed to Guwahati → Shillong, 190 km, 3h 40m, 71% risk, 34% confidence, CAUTION, and compact distance/risk/delay/safety cost metrics. The existing dashboard visual structure remained unchanged. Route selection broadcasts to existing Leaflet map components so their selected route query updates as well.

Automated verification: 31 tests passed across 8 files, TypeScript passed, and production build passed.
