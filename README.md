# Magicka (working title)

A tile-based browser MMO: skilling makes gear, gear kills bosses, and a boat takes you from the starter island to the mainland. "Magicka" is also the title of an existing commercial game, so choose another name before a public launch (`GAME_NAME` in `shared/src/content.ts`).

## Run

Needs Node 22+, Go 1.27+, and `buf` only when changing the message schema.

    npm install
    npm run dev        # http://localhost:5173, game server on 3000; restart it after editing Go code
    npm test           # browser and Go tests
    npm run loadtest   # 100 bots for five minutes; `-- -n 500 -s 60` for other sizes

After editing data or messages:

    npm run content    # content/src -> content/data, which both sides load
    npm run proto      # proto/ -> generated Go and TypeScript

Production, one binary and one port:

    npm run build
    npm start

| Variable          | Default        | Purpose                                              |
| ----------------- | -------------- | ---------------------------------------------------- |
| `PORT`            | 3000           | HTTP and WebSocket port                              |
| `DB_PATH`         | `magicka.db`   | SQLite file (`npm run dev` uses `server/magicka.db`) |
| `CLIENT_DIR`      | `client/dist`  | Built client                                         |
| `ALLOWED_ORIGINS` | same host only | Comma-separated origins                              |

Messages are binary. To read them in development, open `http://localhost:5173/?messages`, or start the server with `LOG_MESSAGES=1`.

Put a TLS proxy in front for public use. Login limits count the socket address, so behind a proxy all players share one limit until forwarded addresses are supported.

## Controls

Click to walk, gather, attack, take and use. Right click for options. Arrow keys or middle drag turn the camera; wheel zooms. Enter chats. Drag items to rearrange them.

## Dev commands

Only with `MAGICKA_DEV=1` (set by `npm run dev`; refused in production): `/give item n`, `/level skill|all n`, `/tp x y`, `/map island|mainland`, `/boss`, `/heal`, `/die`. The world boss also spawns every two minutes instead of ten.

## Layout

- `content/` items, recipes, monsters, loot and maps. Edit `content/src`.
- `proto/` the message schema.
- `server/` the Go server: `internal/game` is the simulation, `internal/store` saves, `internal/auth` accounts, `cmd/server` sockets and ticks.
- `shared/` data loading and formulas for the browser.
- `client/` Three.js scene and DOM interface; `wire.ts` translates messages.
- `docs/` agreed design and decisions; `GLOSSARY.md` terms.

Model gallery while developing: `http://localhost:5173/gallery.html?set=people|hair|head|turn|swing|monsters|nodes|camp&t=600` (`t` freezes the animation at that millisecond).
