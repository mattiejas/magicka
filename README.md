# Driftwake

A tile-based browser MMO: skilling makes gear, gear kills bosses, and a boat of your own takes you out to sea: to the mainland, and to small islands that start in fog. "Driftwake" is a working name that has not been checked for availability; it is set by `GAME_NAME` in `shared/src/content.ts` and `GameName` in `server/internal/game/world.go`.

## Run

Needs Node 22+, Go 1.27+, and `buf` only when changing the message schema.

    npm install
    npm run dev        # http://localhost:5173, game server on 3000; restart it after editing Go code
    npm test           # browser and Go tests
    npm run check      # formatting, linting, types and tests; run before committing
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
| `DB_PATH`         | `driftwake.db`   | SQLite file (`npm run dev` uses `server/driftwake.db`) |
| `CLIENT_DIR`      | `client/dist`  | Built client                                         |
| `ALLOWED_ORIGINS` | same host only | Comma-separated origins                              |
| `TRUSTED_PROXIES` | (none)         | Comma-separated proxy IPs; when the peer matches, login limits use `X-Forwarded-For` / `Forwarded` |
| `MODERATORS`      | nobody         | Comma-separated names of registered players, who type `/mod` for help |

Messages are binary. To read them in development, open `http://localhost:5173/?messages`, or start the server with `LOG_MESSAGES=1`.

Put a TLS proxy in front for public use. Set `TRUSTED_PROXIES` to the proxy's address so login limits count each real client instead of the shared socket address. Forwarded headers from untrusted peers are ignored.

## Controls

Click to walk, gather, attack, take and use. Right click for options. Arrow keys or middle drag turn the camera; wheel zooms. Enter chats. Drag items to rearrange them; Shift and click drops them.

## Moderating

Start the server with `MODERATORS=name,name` for players who have already registered. In chat they type `/mod` for the list of commands: mute, kick, ban, reports and the log of what moderators did. Refused names are in `server/internal/moderation/names.txt`.

## Dev commands

Only with `DRIFTWAKE_DEV=1` (set by `npm run dev`; refused in production): `/give item n`, `/level skill|all n`, `/tp x y`, `/map island|mainland`, `/map mine`, `/encounter vein|trader|stampede`, `/genie`, `/boss`, `/heal`, `/die`. The world boss also spawns every two minutes instead of ten.

See [CONTRIBUTING.md](CONTRIBUTING.md) before changing code.

## Layout

- `content/` items, recipes, monsters, loot and maps. Edit `content/src`.
- `proto/` the message schema.
- `server/` the Go server: `internal/game` is the simulation, `internal/store` saves, `internal/auth` accounts, `internal/moderation` safety, `cmd/server` sockets and ticks.
- `shared/` data loading and formulas for the browser.
- `client/` Three.js scene and DOM interface; `net/` the connection, `scene/` the 3D view, `models/`, `ui/`.
- `docs/` agreed design and decisions; `GLOSSARY.md` terms.

The `throwaway` entry in `.claude/launch.json` starts a server with an empty database on port 3997, for trying things out.

Model gallery while developing: `http://localhost:5173/gallery.html?set=people|hair|head|turn|swing|guard|blend|monsters|chicken|capes|nodes|camp&t=600` (`t` freezes the animation at that millisecond).
