# BudgetApp (Vite)

This project was migrated from a static HTML/CSS/JS setup to a **Vite** vanilla project.

## Local dev

```bash
npm install
npm run dev
```

## Build + preview

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow that builds the app and deploys the `dist/` folder to GitHub Pages on every push to `master`.

- **One-time GitHub setup**:
  - Go to `Settings` → `Pages`
  - Under **Build and deployment**, set **Source** to **GitHub Actions**

- **Deploy**:
  - Push to `master`, then check `Actions` for the **Deploy to GitHub Pages** workflow run.
  - Your site will be available at `https://<username>.github.io/<repo>/`

## Notes

- Static assets live in `public/` and are served at the site root.
- App entrypoint is `src/main.js` (which imports `src/app.js`).

