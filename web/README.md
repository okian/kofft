# Web Micro-Frontend Workspace

This directory contains a refactored micro-frontend implementation of the spectrogram app, structured per the team playbook.

Structure:

```
web/
├─ apps/
│  └─ mfe-spectrogram/
│     └─ src/
│        ├─ index.tsx                 # MFE lifecycle: mount()/unmount()
│        ├─ app/App.tsx               # Local app shell with providers
│        ├─ layout/                   # Layout components (header/footer)
│        ├─ features/                 # Feature-sliced UI
│        └─ shared/                   # Local shared layer (stores/hooks/utils/types)
├─ configs/                           # Reserved for shared configs (vite/ts/linters)
└─ docs/
```

## Quick Start

To run the web application:

```bash
# Install dependencies for all apps
npm run install:all

# Start both MFE and shell in development mode
npm run dev
```

This will start:
- **MFE Spectrogram** at http://localhost:5176 (micro-frontend)
- **Shell** at http://localhost:5174 (host application)

## Development

- **MFE only**: `npm run dev:mfe` - runs just the spectrogram micro-frontend
- **Shell only**: `npm run dev:shell` - runs just the host shell
- **Build all**: `npm run build` - builds both applications for production

## Architecture Notes

- Heavy compute stays off the UI thread; rendering prefers WebGL.
- The MFE exposes `mount(el, props)` and `unmount(el)` for host shells.
- Communication happens via props/events; no global singletons aside from React/Zustand stores local to this MFE.


