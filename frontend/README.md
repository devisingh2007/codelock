# Murder Mystery Frontend

This is the frontend for a multiplayer AI Game Master murder mystery web app, built with React and Vite.

## Folder Structure

```text
codelock/
├── backend/                  # (Coming Soon) Backend server files
└── frontend/
    ├── public/               # Static assets
    ├── src/
    │   ├── api/
    │   │   └── gameApi.js    # Data-access layer simulating API/Socket.io calls
    │   ├── components/       # Reusable UI components
    │   │   ├── ActionPanel.jsx
    │   │   ├── CharacterSheet.jsx
    │   │   ├── InvestigationFeed.jsx
    │   │   └── PlayerCard.jsx
    │   ├── mocks/
    │   │   └── mockData.js   # Centralized mock data for UI development
    │   ├── pages/            # React Router page components
    │   │   ├── CreateRoomPage.jsx
    │   │   ├── GamePage.jsx
    │   │   ├── JoinRoomPage.jsx
    │   │   ├── LandingPage.jsx
    │   │   ├── LobbyPage.jsx
    │   │   └── RevealPage.jsx
    │   ├── styles/
    │   │   └── theme.css     # Global CSS variables and noir theme tokens
    │   ├── App.jsx           # App routing configuration
    │   ├── config.js         # Global configuration (e.g., API_BASE_URL)
    │   └── main.jsx          # Application entry point
    ├── index.html            # Vite HTML template
    ├── package.json          # Frontend dependencies and scripts
    └── vite.config.js        # Vite configuration
```

## Running the App

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```

## Design Architecture

- **Theme**: Dark noir aesthetic, styling elements using CSS variables defined in `src/styles/theme.css`.
- **Fonts**: `Playfair Display` (serif) is used exclusively for in-character content to distinguish it from UI elements, which use `Inter` (sans-serif).
- **Backend Readiness**: All UI components are wired to `src/api/gameApi.js`, which currently returns promises from `src/mocks/mockData.js`. To integrate with a real backend later, only `gameApi.js` needs to be updated.
