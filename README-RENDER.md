# The HTML Archives — Render deployment

## Render settings

Build Command:
```text
./build
```

Start Command:
```text
npm start
```

Root Directory:
```text
.
```

The repository root must contain `build`, `package.json`, `server.js`, and `public/`.

### Important
This version uses the existing local `data/` directory for archive storage. On Render's standard filesystem, uploaded archive data is not guaranteed to survive a service replacement/redeploy. The app itself is deployable and functional; persistent archive storage requires an external database/storage service.
