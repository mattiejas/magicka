# Working on this code

Run `npm run check` before every commit: formatting, linting, types, and all tests. `npm run format` fixes most of what it finds. GitHub runs the same checks on every pull request and on `main`, and also the build and a check that the generated protobuf code is up to date.

Use the words in [GLOSSARY.md](GLOSSARY.md). What the game should become is in [docs/design.md](docs/design.md), and decisions with their reasons are in [docs/adr](docs/adr).

## Where things go

| You want to change | Go to | Then |
|---|---|---|
| An item, recipe, monster, loot or map | `content/src` | `npm run content` |
| A message between browser and server | `proto/driftwake/v1/game.proto` | `npm run proto`, then `client/src/net/wire.ts` and `server/internal/game/validate.go` |
| A number that shapes play | `server/internal/game/rules.go` or `formulas.go` | |
| How fast skills level | `server/internal/game/pace_test.go` measures it; change `XPForLevel` or the nodes | `go test ./server/internal/game -run Pace -v` |
| A formula the browser also shows | `formulas.go` and `shared/src/formulas.ts` | add a case in `content/build.ts`, `npm run content` |
| What players can do | `server/internal/game/intents.go`, then `actions.go` | |
| A boss attack | `content/src/items.ts`, `server/internal/game/bosses.go`, `client/src/scene/telegraphs.ts` | |
| A model | `client/src/models` | look at it in `/gallery.html` |
| A panel | `client/src/ui/panels` | |

## How it fits together

- **The server decides everything.** Browsers send intents; the server checks and carries them out on the next tick.
- **`internal/game` is pure.** It knows no sockets and no database, and takes its randomness from outside, so tests can run thousands of ticks in a moment. Nothing in it may read the clock.
- **One tick** is `Step` in `step.go`: intents, players, monsters and bosses, clean-up, snapshots.
- **Snapshots hold changes only.** A new visible field of an entity needs `fields`, its view, one line in `describe`, and `mergeEntity`. `TestDeltasRebuildTheWorld` compares and exercises every field, so it needs `shown` and, if play rarely changes the field, `disturb`.
- **`mergeEntity` is tested with bytes the server wrote.** Put a new field in `record_test.go`, then `npm run record`. The tests fail when the recording is out of date, lacks a field, or holds one that `mergeEntity` ignores.
- **The browser** keeps what it knows in `net/state.ts`. Only `net/connection.ts` writes to it; the scene and the interface read it.

## Style

- Names say what a thing is. Single letters are for coordinates, loop counters and short closures.
- One file, one subject. Past about 300 lines, look for a second subject. Model files may run longer, since most of their lines are coordinates.
- Give numbers with a meaning a name, next to what they affect. Coordinates of models are data and stay where they are.
- Comments explain why, or what is not obvious. They do not repeat the code.
- Prefer early returns and small functions to nesting. Prefer a table to a long chain of conditions.
- Every rule of the game gets a test in `server/internal/game`, named after the rule.
- Text players read is plain and short, and says what to do.
