# Abans Tender Reading Management

Static tender-entry and tender-report web application using Firebase Realtime Database.

## GitHub Pages deployment

1. Create a new GitHub repository.
2. Upload these project files to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
5. Open the GitHub Pages URL supplied by GitHub. The application starts at `index.html`.

No localhost server is required after deployment. Firebase records are loaded directly from the configured Realtime Database.

## Important

The current Firebase rules allow public access. Before wider use, secure the database with Firebase Authentication and restricted rules.
