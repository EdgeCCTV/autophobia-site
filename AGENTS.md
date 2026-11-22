# AGENTS

This repo is only the public website. GitHub Pages serves the root of this repo at https://autophobia.me/.

The game is not here. It is the private repo https://github.com/EdgeCCTV/autophobia. Do not add `src/`, `assets/`, `server.py`, or audio to this repo.

## Files

These files at the root are the live site:

- `index.html` — home page
- `games.html` — mini-game hub
- `style.css`
- `script.js`
- `CNAME` — must stay the single line `autophobia.me`
- `.nojekyll` — leave this empty file here so GitHub does not rewrite the page

## How to change the website

The same files also live in `docs/` inside `EdgeCCTV/autophobia`. That private repo cannot turn on GitHub Pages, so a push there does not update the domain.

When you change the site:

1. Edit `docs/` in `EdgeCCTV/autophobia` and push that repo.
2. Copy those `docs/` files to the root of this repo (not into a `docs/` folder) and push this repo.

Do not delete the game in the private repo to publish the website. Do not delete these files to "clean up". This folder is what https://autophobia.me/ shows.

Johnny's GitHub login is `KilrFish`. Commits on his computer are `Johnny` / `johnny@autophobia.me`. Robert's are `Robert Young` / `robertyoung@edgecctv.com`. Never commit as `EdgeCCTV` or `ChloesAutoRepairDev`.
