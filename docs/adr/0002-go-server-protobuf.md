# The server is written in Go and speaks protobuf

The first server was TypeScript and shared its code with the browser. We rewrote it in Go before the large feature work began, and replaced JSON with one protobuf schema that generates both sides' message types. Item, recipe, monster and map data became files that both sides load, so rules are not written twice.

## Considered Options

- **Stay on TypeScript.** It was fast enough for the target audience; network traffic was its nearest limit. Rejected in favour of switching while the server was still small.
- **C# or Rust.** C# was a close second. Rust was judged too slow to change while the design keeps moving.

## Consequences

Formulas the browser also needs exist in both languages, and are held together by shared test values in `content/data/vectors.json`. Snapshots carry only changed fields, so an entity's delta is meaningless without the state before it.
