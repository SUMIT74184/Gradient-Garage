# Gradient Garage

An open-source hub for ML models and fine-tunes: a catalog, fine-tune lineage, benchmark leaderboard, and per-model detail drawer, under an animated gold halftone hero (`GoldParticleWave`).

## Run

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

## Adding models

Models come from two places, merged by id:

1. **`src/data/models.ts`**: your local registry. Add descriptions, benchmarks, datasets and links here. (The entries there now are sample data.)
2. **Hugging Face**: set `HF_USERNAME` in `.env.local` and every public model under that user/org is listed automatically, cached for an hour.

When a local entry has the same id as a Hugging Face model, downloads, likes and the updated date come live from Hugging Face, and everything else comes from the local file.

## Structure

- `src/components/GoldParticleWave.tsx`: canvas particle wave (DPR-aware, ResizeObserver, reduced-motion, pauses offscreen)
- `src/components/Hero.tsx`: hero card with metrics and CTAs
- `src/components/ModelCatalog.tsx`: search, task/type filters, sorting
- `src/components/FineTunedSection.tsx`: base → fine-tune lineage
- `src/components/Leaderboard.tsx`: per-benchmark ranking (supports `lowerIsBetter`)
- `src/components/ModelDrawer.tsx`: details, benchmarks, Python/cURL snippets, links
- `src/components/Landing.tsx`: landing sections (manifesto, what-is, try-it terminal, feature cards, open-source stats, FAQ)
- `src/components/motion/`: motion graphics (live training monitor, typing terminal, neural net, lineage tree, benchmark bars, word flip, count-up, scroll reveal)
- `src/components/CommandPalette.tsx`: ⌘K model search
- `src/config/site.ts`: name, author, links
- `src/lib/models.ts`: Hugging Face fetch and merge

Theme colors (navy base, orange accent, gold particle ramp) live in `src/app/globals.css` under `@theme`.

## Credits

- Elephant photo behind the "Try it out" terminal (`public/elephant.jpg`): [African sunset with elephant](https://commons.wikimedia.org/wiki/File:African_sunset_with_elephant.jpg) by Liv Unni Sødem, CC BY 2.0. It's rendered as particles by `GoldParticleWave` (`image`, `imageFocus`, `imageZoom` props); swap the file to use another photo.
