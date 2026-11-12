# Scientific Calculator

A scientific calculator in plain HTML, CSS and JavaScript with a clean, responsive web layout.
No build step and no dependencies.

## Features

- Trigonometry: sin, cos, tan and their inverses, plus hyperbolic functions (`hyp`), in DEG / RAD / GRA
- x², x³, xʸ, √, ∛, ʸ√x, x⁻¹, n!, log, ln, 10ˣ, eˣ, logₐx, |x|, %
- Fractions (`a⌟b`) and the `S⇔D` toggle between fraction and decimal results
- nPr, nCr, ×10ˣ, π, e, random numbers
- Degrees/minutes/seconds input and display (`° ′ ″`), engineering notation (`ENG`)
- Memory panel: variables A, B, C, D, X, Y, M with their values shown. `STO →` then a variable saves the result, tapping a variable uses it (e.g. `2A + B`), plus `M+` / `M−` and Clear. Values are kept between visits.
- Cursor editing (◀ ▶), history replay (▲ ▼) and `Ans`
- Light and dark theme that follows the system setting
- English and Czech: the CZ / EN switch in the header translates the whole site (`i18n.js`); Czech browsers start in Czech
- Keyboard support; memory, angle mode and history are saved in the browser

## GPS coordinates page (`coords.html`)

- Enter points as latitude/longitude in decimal or DMS (`50.4743964N, 14.3278153E`, `50°28′27.8″N 14°19′40.1″E`), or paste a whole list
- Interactive 3D globe (drag to turn, scroll/pinch to zoom from the whole Earth down to a few metres) showing the great-circle path and the spherical triangle with the North Pole: sides 90° − lat₁, 90° − lat₂, angle Δlon at the pole, and the latitude, longitude and central angles at the Earth's centre
- Two points: great-circle distance, central angle, initial and final bearing, midpoint, rhumb-line distance, with the calculation shown step by step (spherical law of cosines)
- Polygon area on the sphere, perimeter, centroid, orientation, warning for crossing edges; decimal ⇄ DMS converter

Land and borders come from [Natural Earth](https://www.naturalearthdata.com/) (public domain) via world-atlas and are bundled in `earth-data.js`.

## Star map page (`stars.html`)

An interactive planisphere (rotating star map):

- Drag the star disc to turn it; the date ring on the disc lines up with the hour ring on the cover, just like a paper planisphere
- Zoom with the mouse wheel, pinch or the +/− buttons; "Sky window" zooms straight to the visible sky
- The horizon window is calculated for any latitude/longitude (northern and southern hemisphere); pick a city or use your location
- About 5 000 stars down to magnitude 6, constellation lines and names (English, Czech, Latin), Milky Way, ecliptic, Messier objects and the Sun
- Hover a star for its name, constellation, magnitude, altitude and direction
- Animate the sky, jump to now, or set any date and time

Star data comes from [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD-3-Clause, see `LICENSE-d3-celestial.txt`) and is bundled in `stars-data.js`.

## Sun declination page (`sun.html`)

- Table of the Sun's declination for every day of the year (`sun-data.js`), today highlighted
- Pick a date or click a cell to see its declination, the Sun's noon height and the day length for your latitude
- Year chart of the declination (solstices and equinoxes marked), the noon Sun height or the day length for your latitude; hover to read a day, click to look it up (`sun.html#noon`, `#day` open those views)

## Run locally

Open `index.html` in a browser.

## Deploy to GitHub Pages

1. Push these files to the root of a GitHub repository.
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, then pick `main` and `/ (root)`.
3. The site is published at `https://<user>.github.io/<repo>/`.
