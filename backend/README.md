# MysteryVerse Backend

Welcome to the backend foundation for MysteryVerse-AI. This service is built with Node.js, Express, and Mongoose.

## Requirements

- **Node.js**: `>=20.0.0`
- **MongoDB**: Active instance or running via Docker

## Getting Started

### 1. Install Dependencies

Install required dependencies using npm:

```bash
npm install
```

### 2. Environment Configuration

Copy the sample environment file and adjust the variables as needed:

```bash
cp .env.example .env
```

Define the following environment variables:
- `PORT`: Port for the Express server to listen on (default: `3000`)
- `MONGO_URI`: The MongoDB connection string
- `JWT_SECRET`: Secret key used for signing JWTs

### 3. Development Server

Run the development server with hot-reloading using Nodemon:

```bash
npm run dev
```

### 4. Code Quality & Linting

Run ESLint to check for stylistic and code issues:

```bash
npm run lint
```

### 5. Running Tests

Execute the unit tests using Jest:

```bash
npm run test
```

## Docker Containerization

To spin up the entire system including the MongoDB database:

```bash
docker-compose up --build
```

## Authentication API Usage

The following endpoints are registered under `/api/auth`:

### 1. User Registration
* **Endpoint:** `POST /api/auth/register`
* **Request Body:**
  ```json
  {
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }
  ```
* **Response (201):** `{ "token": "jwt_token_here" }`

### 2. User Login
* **Endpoint:** `POST /api/auth/login`
* **Request Body:**
  ```json
  {
    "email": "test@example.com",
    "password": "password123"
  }
  ```
* **Response (200):** `{ "token": "jwt_token_here" }`

### 3. User Profile (Protected)
* **Endpoint:** `GET /api/auth/profile`
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Response (200):**
  ```json
  {
    "username": "testuser",
    "email": "test@example.com",
    "createdAt": "2026-07-10T05:51:00.000Z"
  }
  ```

## Game Room Endpoints

The following endpoints are registered under `/api/game`:

### 1. Create Room (Protected)
* **Endpoint:** `POST /api/game/create`
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Body:** `{}` (None required)
* **Response (200):**
  ```json
  {
    "success": true,
    "room": {
      "roomCode": "AB12CD",
      "host": "userId1",
      "players": ["userId1"],
      "status": "waiting",
      "maxPlayers": 4,
      "createdAt": "2026-07-10T06:00:00.000Z"
    }
  }
  ```

### 2. Join Room (Protected)
* **Endpoint:** `POST /api/game/join`
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Body:**
  ```json
  {
    "roomCode": "AB12CD"
  }
  ```
* **Response (200):**
  ```json
  {
    "success": true,
    "room": {
      "roomCode": "AB12CD",
      "host": "userId1",
      "players": ["userId1", "userId2"],
      "status": "waiting",
      "maxPlayers": 4,
      "createdAt": "2026-07-10T06:00:00.000Z"
    }
  }
  ```

### 3. Fetch Room Details (Protected)
* **Endpoint:** `GET /api/game/:roomCode`
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Response (200):**
  ```json
  {
    "success": true,
    "room": {
      "roomCode": "AB12CD",
      "host": "userId1",
      "players": [
        {
          "_id": "userId1",
          "username": "hostUser",
          "email": "host@example.com"
        }
      ],
      "status": "waiting",
      "maxPlayers": 4,
      "createdAt": "2026-07-10T06:00:00.000Z"
    }
  }
  ```

### 4. Delete Room (Protected, Host Only)
* **Endpoint:** `DELETE /api/game/:roomCode`
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Response (200):**
  ```json
  {
    "success": true
  }
  ```

## Seeding Sample Game Rooms

To populate your database with dummy rooms and users for local testing:

```bash
node scripts/seedRooms.js
```

---

## Real-Time Socket.IO (Phase 4)

The server exposes a Socket.IO endpoint at the same port as the HTTP server. All socket connections require a valid JWT token passed in the handshake `auth` object.

### Connecting

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  auth: { token: "<your_jwt_token>" },
  transports: ["websocket"],
});
```

### Events

#### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-room` | `roomCode: string` | Join a game room and receive chat history |
| `leave-room` | `roomCode: string` | Leave a game room |
| `room-message` | `{ roomCode, message }` | Send a chat message (max 500 chars) |

#### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user-joined` | `{ userId, username, roomCode }` | A new player joined the room |
| `user-left` | `{ userId, username, roomCode }` | A player left the room |
| `room-message` | `{ id, roomCode, sender, message, timestamp }` | A new message broadcast to the room |

### Acknowledgements

`join-room`, `leave-room`, and `room-message` support callbacks:

```js
socket.emit("join-room", "ABCDE1", (response) => {
  if (response.error) console.error(response.error);
  else {
    console.log("Joined room:", response.roomCode);
    console.log("Chat history:", response.chatHistory);
  }
});
```

### Rate Limiting

Each socket is rate-limited to **10 messages per 5 seconds**. Exceeding this returns an error in the acknowledgement callback.

### Chat Persistence

All messages sent via `room-message` are persisted to MongoDB (`ChatMessage` collection) and auto-deleted after **24 hours** via a TTL index. When a client joins a room, the last **20 messages** are returned in the `join-room` acknowledgement.

---

## Game State Engine (Phase 5)

The Game State Engine is the **authoritative server-side state** for each multiplayer mystery room. It combines REST APIs and real-time Socket.IO synchronisation.

### REST Endpoints

All endpoints require `Authorization: Bearer <jwt>`.

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/game/:roomId/state` | Get (or auto-create) GameState |
| `POST` | `/api/game/:roomId/state/update` | Apply versioned partial update |
| `POST` | `/api/game/:roomId/state/advancePhase` | Advance phase (host only) |
| `POST` | `/api/game/:roomId/state/restore` | Re-sync state from DB |

#### Update body format

```json
{
  "changes": {
    "story": { "victim": "Lord Blackwell", "location": "Library" },
    "eventsLog": [{ "event": "First clue found" }]
  },
  "version": 3
}
```

Returns `409 Conflict` if `version` does not match the current `__v` in the database.

### Game Phases

Phases advance in order: **lobby → investigation → voting → reveal**

Only the room host can call `advancePhase`. Once at `reveal`, no further advancement is possible.

### Socket.IO Game State Events

#### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-game-room` | `{ roomId }` | Join state room; receive `sync-state` |
| `leave-game-room` | `{ roomId }` | Leave state room |
| `state-update` | `{ roomId, changes, version }` | Versioned state update |
| `request-advance-phase` | `{ roomId }` | Host requests phase advance |
| `request-sync` | `{ roomId }` | Force re-sync from DB |

#### Server → Client

| Event | Payload | Description |
|---|---|---|
| `sync-state` | `{ state }` | Full state on join or restore |
| `state-changed` | `{ state }` | Broadcast after any mutation |
| `phase-advanced` | `{ state }` | Broadcast after phase advance |
| `state-error` | `{ error, code? }` | Error notification |

Error codes: `VERSION_CONFLICT` (409), `UNAUTHORISED` (403), `FINAL_PHASE` (400).

### Optimistic Concurrency

Every state document has a `__v` field (Mongoose version key). When calling `state/update` or `state-update` socket event, always include the current `version` value. If another update happened in between, the server returns a `409 Conflict` – re-fetch state and retry.

### Data Auto-Expiry (TTL)

`GameState` documents are automatically deleted from MongoDB after **7 days** of inactivity (configurable via `GAME_STATE_TTL_SECONDS` environment variable).

### Seed Game States

```bash
node scripts/gameStateSeed.js
```

Creates 4 sample rooms in all phases (lobby, investigation, voting, reveal).

---

## AI Mystery Generator (Phase 6)

Phase 6 adds an Ollama-powered mystery generator that creates a complete murder-mystery scenario and broadcasts it to all room players via Socket.IO.

### Prerequisites

1. Install and start [Ollama](https://ollama.com/) locally:
   ```bash
   ollama serve
   ollama pull llama3   # or mistral, gemma2, etc.
   ```

2. Add the following variables to your `.env` file:
   ```env
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3
   OLLAMA_API_KEY=          # leave empty for local Ollama (no auth required)
   OLLAMA_RATE_LIMIT_PER_MIN=10
   OLLAMA_TIMEOUT_MS=60000
   OLLAMA_MAX_RETRIES=3
   ```

### Endpoint

**`POST /api/game/:roomCode/generate-mystery`**

| | |
|---|---|
| **Auth** | `Authorization: Bearer <host_jwt_token>` |
| **Access** | Room host only |

Optional request body:
```json
{
  "difficulty": "easy | medium | hard",
  "locationHints": "Victorian manor in Yorkshire"
}
```

Successful response `200 OK`:
```json
{
  "success": true,
  "story": {
    "title": "Death in the Manor",
    "location": "Thornfield Estate, Yorkshire",
    "victim": { "name": "Lord Aldric Vane", "description": "Wealthy landowner…" },
    "crime": { "type": "poisoning", "weapon": "Arsenic", "summary": "…", "killer": "Dr. Helena Marsh" },
    "suspects": [
      { "name": "Dr. Helena Marsh", "background": "…", "relationshipToVictim": "…", "isMurderer": true },
      { "name": "Edward Crane", "background": "…", "relationshipToVictim": "…", "isMurderer": false }
    ],
    "timeline": [
      { "time": "18:00", "event": "Guests arrive at the manor" },
      { "time": "21:00", "event": "Lord Vane collapses in the library" }
    ],
    "generatedAt": "2026-07-10T12:00:00.000Z"
  }
}
```

Error responses: `401` (no token), `403` (not host), `400` (invalid room code), `500` (AI failure).

### Sample cURL

```bash
# 1. Login to get a token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"host@example.com","password":"password123"}' | jq -r .token)

# 2. Generate a mystery for room AB12CD
curl -X POST http://localhost:3000/api/game/AB12CD/generate-mystery \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"medium","locationHints":"Victorian manor in the English countryside"}'
```

### Ollama Prompt Template

The exact prompt sent to the LLM:

```
Generate a murder mystery for 4 players (difficulty: medium). The setting is: Victorian manor.

The output MUST be a single valid JSON object with EXACTLY these keys: "title", "location", "victim", "crime", "suspects", "timeline".
Do NOT include any explanatory text, markdown, code fences, or any characters outside the JSON object.

Required schema:
{
  "title": "A creative title for the mystery",
  "location": "Specific location name and brief description",
  "victim": {
    "name": "Full name of the victim",
    "description": "Short background about the victim"
  },
  "crime": {
    "type": "Type of crime (e.g. poisoning, stabbing, strangulation)",
    "weapon": "The murder weapon",
    "summary": "Two to three sentences describing how the crime occurred",
    "killer": "Full name of the murderer (must exactly match one suspect name)"
  },
  "suspects": [
    {
      "name": "Suspect full name",
      "background": "Brief backstory",
      "relationshipToVictim": "How they knew the victim",
      "isMurderer": false
    }
  ],
  "timeline": [
    { "time": "HH:MM", "event": "What happened at this time" }
  ]
}

Rules:
- Provide EXACTLY 4 suspects.
- Exactly ONE suspect must have "isMurderer": true; all others must have "isMurderer": false.
- The "crime.killer" field must exactly match the "name" of the suspect where "isMurderer" is true.
- The "timeline" must have at least 4 entries covering the evening of the murder.
- Return ONLY the raw JSON object. No markdown, no code blocks, no extra text.
```

### Socket.IO Event

After the mystery is generated, all sockets in the room receive:

```json
{
  "event": "mystery-generated",
  "payload": {
    "roomCode": "AB12CD",
    "story": { ... }
  }
}
```

### Run Tests

```bash
npm test                                    # run all 183 tests
npm test -- --testPathPattern=ai.test       # Phase 6 tests only
npm test -- --testPathPattern=gameMaster.test # Phase 8 tests only
```

---

## AI Game Master (Phase 8)

The AI Game Master (GM) monitors game state and player messages, applying rules to intervene when players are stuck, make false accusations, or repeatedly claim/state the same thing.

### Configuration

Add the following environment variables to your `.env`:
```env
GM_MAX_CALLS_PER_MIN=5
GM_BACKOFF_MS=5000
```

### Game Master Rules (Trigger Conditions)

Interventions occur automatically during chat message processing under the following conditions:
1. **Stuck Scenario:** 5+ minutes (`timeElapsed >= 300s`) have passed since mystery generation and no clues have been discovered.
2. **False Accusation:** A player makes an accusation (`accuse`, `murderer is`, or `killer is`) pointing to a suspect who is not the true murderer.
3. **Repeated Claims:** A player repeats the exact same claim or message 3 or more times recently.

### Ollama Game Master Prompt Template

```
You are the AI Game Master (GM) for a multiplayer murder-mystery game.
The game location is: "{location}".
The victim is: "{victim.name}" ({victim.description}).
The true killer/murderer is: "{crime.killer}".
The suspects are: [...]

An intervention rule has been triggered:
Trigger Type: {stuck | false_accusation | repeated_claims}
Reason: {reason}

Recent chat messages from players:
{messagesContext}

As the Game Master, you must intervene to guide the players, resolve a false accusation, address repeated claims, or provide a hint/clue.
Your response MUST be a single valid JSON object with the following structure:
{
  "actionType": "hint" | "event" | "clue",
  "content": "The message or announcement from the Game Master to be shown to the players.",
  "recipient": "all" | "username_of_player",
  "payload": {
    "clueName": "Optional name of the clue if actionType is clue",
    "details": "Any optional extra details"
  }
}
```

### Socket.IO Events

The following events are dispatched dynamically to room members when a GM intervention triggers:
- `gm-action`: `{ roomCode, actionType, content, recipient, payload }`
- `gm-hint` (if `actionType === 'hint'`): `{ roomCode, content, recipient, payload }`
- `gm-event` (if `actionType === 'event'`): `{ roomCode, content, recipient, payload }`

### GameState Extensions

The Game Master logs all actions in the game state document:
- `GameState.story.gmHistory[]`: Log of every generated action (`actionType`, `content`, `timestamp`).
- `GameState.story.pendingActions[]`: Queue of actions to be processed (`actionType`, `payload`, `createdAt`).
---

## Investigation & Voting System (Phase 9)

Phase 9 introduces the main gameplay loops where players can investigate clues, ask questions, inspect locations, accuse players, cast suspect votes, and transition the game state to final resolution.

### API Endpoints

All endpoints require `Authorization: Bearer <jwt>`.

#### Investigation Endpoints
- `POST /api/investigation/action`: Creates an action (`ASK_QUESTION`, `INSPECT_LOCATION`, `INSPECT_CLUE`, `ACCUSE_PLAYER`). Validated to ensure game is in `investigation` phase.
- `GET /api/investigation/:roomId/history`: Retrieves full investigation history for the room.
- `GET /api/investigation/:roomId/evidence`: Retrieves list of discovered clues vs all story clues.

#### Voting Endpoints
- `POST /api/vote`: Casts a vote for suspected murderer. Validated to ensure game is in `voting` phase.
- `GET /api/vote/:roomId/results`: Calculates current round votes and returns the leader/tie results.
- `POST /api/game/:roomId/start-voting`: Starts the voting phase (host only). Transition: `investigation` -> `voting`.
- `POST /api/game/:roomId/end-voting`: Ends the voting phase, calculates result, and moves the game to `reveal` phase (host only).

### Socket.IO Events
The system emits real-time events to all sockets in the game room:
- `investigation:action`: `{ roomId, playerId, actionType, target, message, metadata }`
- `investigation:update`: `{ roomId, gameState }`
- `clue:discovered` (if clue): `{ roomId, playerId, clue: target }`
- `player:accused` (if accusation): `{ roomId, playerId, suspect: target }`
- `state-changed`: `{ roomId, gameState }`
- `phase-changed`: `{ roomId, phase, results? }`

### Run Tests
```bash
npm test                                                 # run all 187 tests
npm test -- --testPathPattern=investigationAndVoting.test # Phase 9 tests only
```
