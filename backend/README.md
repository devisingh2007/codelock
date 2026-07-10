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

