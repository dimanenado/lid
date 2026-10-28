# Leben in Deutschland prep

Practice app for the German "Leben in Deutschland" test and the Einbürgerungstest. Every question is shown in German with a translation side by side: English, Turkish or Russian, picked in Settings.

- Practise by topic, your federal state's 10 questions, new questions, or all 300 general questions.
- Mock exam: 30 general + 3 state questions, 60 minutes, 17 correct to pass.
- Review mistakes: wrong answers stay in the pile until answered correctly twice in a row.
- Key words: the words that link a question to its answer are highlighted, negations ("nicht", "kein") stand out in red, and after answering, a "Don't mix up" box lists look-alike questions with their different answers. Can be turned off in Settings.
- Browse and search all questions in German or the chosen translation.
- Progress is stored in the browser; export/import it as a JSON file.
- Works offline: a service worker (`public/sw.js`) serves the app from the browser cache, and by default the whole app (about 3.5 MB of code, translations and images) is downloaded in the background. Settings → Offline use turns this off and shows what is saved. The build writes `offline-manifest.json` listing every file with a content hash, so after a deploy only changed files are downloaded again.

## Data

`src/data/questions.json` is generated from the official BAMF PDF "Gesamtfragenkatalog zum Test Leben in Deutschland" (Stand 07.05.2025): 300 general questions and 10 per federal state. Images are in `public/images/`.
Translations are unofficial. English lives in `src/data/questions.json`; other languages are in `src/data/translations/<lang>.json` (question id → question and 4 options) and load only when picked. Key-word highlighting covers German and English only. All 460 answers were checked against the official BAMF online tool (oet.bamf.de) on 2026-10-15 and are marked `"answerStatus": "verified"`; new or changed answers should be set to `"draft"` until checked again.

Key words: `scripts/keywords.txt` lists, per question, the words that link it to its answer (German and English) and groups of look-alike questions that have different answers. `python3 scripts/keywords.py` checks every cue against the text and writes `src/data/keywords.json`. Questions with identical German text but a different answer are linked automatically.

Regenerate the raw data from a new PDF with the scripts in `scripts/` (needs `pdftotext` and `pip install pymupdf pillow`):

```sh
pdftotext -layout catalog.pdf catalog.txt
python3 scripts/parse.py catalog.txt q.json
python3 scripts/images.py catalog.pdf q.json img/
```

## Development

```sh
npm install
npm run dev
npm run build   # static site in dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml` (enable Pages with source "GitHub Actions" in the repo settings).
