# Frontend API Guide

This document outlines the local development cycle and API communication for the TeamHub frontend.

## Running Both Apps Concurrently

To run both the frontend (React/Vite) and the backend API (Hono/Bun) at the same time:

1. Open a terminal at the root of the project (`thub`).
2. Run the development script:
   ```bash
   bun run dev
   ```
This command uses `concurrently` to spin up both processes in the same terminal window, prefixing logs with their respective project names so you can clearly see what's happening side-by-side.

## API Communication

The backend API is designed to make local development seamless:

*   **URL:** The backend runs at `http://localhost:3001`
*   **CORS:** Cross-Origin Resource Sharing is enabled globally. You can use standard `fetch` or `axios` directly to the `localhost:3001` from the frontend without encountering CORS errors.

### Example Request (Frontend)

```javascript
// Example frontend fetch call
const createRoom = async () => {
  const response = await fetch('http://localhost:3001/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  console.log('Room created:', data);
};
```

## Observing Network Requests (Logging)

To help debug request parameters and API responses, **an HTTP Logger middleware** has been added to the backend API (`hono/logger`). 

Every time the frontend makes a request to the backend, you will see the **Method, Path, and Status Code** logged directly in the terminal where `bun run dev` is running.

**Example Terminal Output:**
```
[api] <-- GET /
[api] --> GET / 200 4ms
[api] <-- POST /rooms
[api] --> POST /rooms 201 12ms
```

*   `-->` Arrows indicate incoming/outgoing communication.
*   `200`, `201`, `400`, `500` will quickly verify what the API returns in your dev cycle without having to exclusively rely on the Chrome Network Tab.
