# Stand — 30 Days of Spiritual Combat

A mobile-first, audio-ready devotional app built with plain HTML, CSS, and JavaScript. It includes all 30 days, guided device narration, progress tracking, favorites, private reflection notes, dark mode, and responsive design.

## Run locally

```bash
npm run dev
```

## Publish with GitHub and Vercel

1. Create an empty GitHub repository.
2. Upload this folder or push it with Git.
3. In Vercel, select **Add New → Project**, import the repository, and click **Deploy**.
4. Leave Framework Preset as **Other**. No build command or environment variables are required.

## Audio

The play button uses the browser's built-in Speech Synthesis API, so the available narrator voice depends on the listener's device. For production-recorded audio, add MP3 files under `audio/day-01.mp3` through `audio/day-30.mp3`, then replace the speech-synthesis player in `app.js` with an HTML Audio element.

## Content note

Scripture is presented through brief references and short excerpts. Before commercial publication, select a Bible translation and confirm its quotation and attribution requirements.
