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

