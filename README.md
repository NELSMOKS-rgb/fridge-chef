# Fridge Chef 🍳

A phone web app (PWA): tell it what's in your fridge and cupboard and it shows meals you can cook now, ranked by match %, plus "missing 1–2 items" ideas.

- 230 built-in home recipes with NZ ingredient names (mince, capsicum, kumara, courgette, tomato sauce…), so it works fully offline
- Optional extra recipes from the free [TheMealDB](https://www.themealdb.com) API when online (no key), merged and de-duplicated
- Fridge and Cupboard lists with autocomplete, quick-pick staples and a shopping list, all saved on the phone (localStorage)
- Filters: meal type, under 30 min, vegetarian
- Installable: manifest, icons and a service worker for offline use

Live: https://nelsmoks-rgb.github.io/fridge-chef/

Recipe data lives in `recipes1-3.txt` (`Name|types|minutes|diet|ingredients|steps`); run `node tools/build-data.js` to rebuild `recipes.js`.
