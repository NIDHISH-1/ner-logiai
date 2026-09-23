# Phase 6 Route Verification Notes

The live Government dashboard displayed the existing risk panel plus the new compact `Safety-aware routing` card. It showed `Guwahati → Kohima → Imphal`, 380 km, 7h 20m, 35% risk, 14% confidence, `Safety CAUTION`, and the explicit message `Shortest route rejected by safety validator.` The rejected NH-37/Jorhat corridor listed verified bridge damage, blocked road, and critical verified incident reasons.

The live Truck Driver cockpit retained its existing layout and displayed the same recommended route card beside the driver map and advisory risk panel. The route recommendation remained clearly labeled as an A* prototype and advisory, with no automatic redirection.

Automated verification: 30 tests passed across 8 test files, TypeScript passed, and the production build passed. Route tests cover shortest-safe selection, unsafe-shortest rejection, safer alternative selection, rejected roads never selected, and no-safe-route handling.
