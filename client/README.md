# Impious Werewolf Client

A React + Vite frontend for the Impious Werewolf engine.

## Setup

1.  Make sure the backend is running in the root folder:
    ```bash
    npm run dev
    ```
    (Expected to listen on ws://localhost:3000)

2.  Install client dependencies:
    ```bash
    cd client
    npm install
    ```

3.  Run the client:
    ```bash
    npm run dev
    ```
    (Typically opens on http://localhost:5173)

## Features

* Create/Join games
* Real-time Phase Updates
* Role-specific actions (Traitor kills, etc.)
* Channel-based Chat
* Debug tools for hosts

## Debug Mode

If the backend is started with:

```bash
WEREWOLF_DEBUG=1 npm run dev
```

The host can:

Use "Fill with Bots" in the lobby.

Use "Force Timeout" / "Force Vote" to advance phases for testing.

These debug actions will return an ERROR if debug mode is disabled on the server.
