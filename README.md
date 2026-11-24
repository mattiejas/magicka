# Magicka (working title)

A tile-based browser MMO: skilling makes gear, gear kills bosses, and a boat takes you from the starter island to the mainland. "Magicka" is also the title of an existing commercial game, so choose another name before a public launch (`GAME_NAME` in `shared/src/content.ts`).

## Run

    npm install
    npm run dev        # http://localhost:5173, game server on 3000
    npm test
    npm run loadtest   # 100 bots for five minutes; append "-- 60" for one minute

Production, one process and one port:

    npm run build
    npm start

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP and WebSocket port |
| `DB_PATH` | `magicka.db` | SQLite file |
| `CLIENT_DIR` | `client/dist` | Built client |
| `ALLOWED_ORIGINS` | same host only | Comma-separated origins |

Put a TLS proxy in front for public use. Login limits count the socket address, so behind a proxy all players share one limit until forwarded addresses are supported.

## Controls

Click to walk, gather, attack, take and use. Right click for options. Arrow keys or middle drag turn the camera; wheel zooms. Enter chats. Drag items to rearrange them.

## Dev commands

Only with `MAGICKA_DEV=1` (set by `npm run dev`; refused in production): `/give item n`, `/level skill|all n`, `/tp x y`, `/map island|mainland`, `/boss`, `/heal`, `/die`. The world boss also spawns every two minutes instead of ten.

## Layout

`shared/` content, formulas, maps, pathfinding, protocol. `server/` simulation (`world`, `skilling`, `combat`, `bosses`, `inventory`), accounts, saves. `client/` Three.js scene and DOM interface.
Items, recipes, monsters, loot and boss attacks are data in `shared/src/content.ts`.

Model gallery while developing: `http://localhost:5173/gallery.html?set=people|hair|head|turn|swing|monsters|nodes|camp&t=600` (`t` freezes the animation at that millisecond).
