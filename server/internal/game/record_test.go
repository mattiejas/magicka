package game

import (
	"encoding/hex"
	"encoding/json"
	"flag"
	"os"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

var record = flag.Bool("record", false, "write the recorded entities instead of checking them (npm run record)")

// The browser's test of mergeEntity reads these.
const recordedEntities = "../../../client/src/net/entities.recorded.json"

type recording struct {
	Name  string `json:"name"`
	Bytes string `json:"bytes"` // an encoded Entity, in hexadecimal
}

// encodings are entities as clients are sent them: new ones, then what changes about them.
func encodings() (names []string, encoded [][]byte) {
	add := func(name string, b []byte) { names, encoded = append(names, name), append(encoded, b) }
	isNew := func(name string, v view) { add(name, v.fullBytes()) }
	changes := func(name string, v view, before fields) {
		v.diff(&before)
		add(name, v.delta)
	}

	player := entityID(kindPlayer, 7)
	plain := fields{x: 10, y: 11, name: "Robin", hp: 10, maxHP: 10, level: 1, look: Look{Cut: 1, Color: 2}}
	plain.gear[0] = "sword_1"
	busy := fields{
		x: 12, y: 10, name: "Robin", hp: 9, maxHP: 12, level: 3, look: Look{Cut: 2}, act: "mining", tool: "pickaxe_1",
		target: entityID(kindNode, 1), rooted: true, gear: [5]string{"sword_2", "head_2", "body_2", "legs_2", "cape_magic"},
	}
	isNew("plain player", view{id: player, f: plain})
	changes("player becomes busy", view{id: player, f: busy, via: []Point{{X: 11, Y: 11}, {X: 12, Y: 10}}}, plain)
	changes("player stops", view{id: player, f: plain}, busy)
	isNew("busy player", view{id: player, f: busy})

	boss := entityID(kindMonster, 3)
	idle := &bossState{st: choose}
	slam := &bossState{st: windup, atk: &content.Attack{ID: "boulder"}, tiles: []Point{{X: 4, Y: 5}, {X: 5, Y: 5}}, centres: []Point{{X: 5, Y: 5}}, start: 100, end: 105}
	melee := &bossState{st: execute, atk: &content.Attack{ID: "melee"}, start: 110, end: 112, tgt: player}
	resting := fields{x: 3, y: 4, typ: "gnashclaw", hp: 300, maxHP: 300, boss: true, bossSt: choose}
	slamming := fields{x: 3, y: 4, typ: "gnashclaw", hp: 250, maxHP: 300, boss: true, bossSt: windup, bossStart: 100, target: player}
	striking := fields{x: 3, y: 4, typ: "gnashclaw", hp: 250, maxHP: 600, boss: true, bossSt: execute, bossStart: 110}
	isNew("boss", view{id: boss, boss: idle, f: resting})
	changes("boss winds up", view{id: boss, boss: slam, f: slamming}, resting)
	changes("boss strikes", view{id: boss, boss: melee, f: striking}, slamming)
	isNew("monster", view{id: entityID(kindMonster, 4), f: fields{x: 1, y: 2, typ: "boar", hp: 5, maxHP: 8, target: player}})

	node := entityID(kindNode, 1)
	depleted, shining := fields{x: 20, y: 21}, fields{x: 20, y: 21, glowing: true, rich: true}
	isNew("depleted node", view{id: node, f: depleted})
	changes("node glows and is rich", view{id: node, f: shining}, depleted)
	changes("node is depleted", view{id: node, f: depleted}, shining)
	isNew("glowing, rich node", view{id: node, f: shining})

	isNew("trader", view{id: entityID(kindNPC, 1), f: fields{x: 5, y: 6, typ: npcTrader, wants: "copper_ore"}})
	isNew("genie", view{id: entityID(kindNPC, 2), f: fields{x: 5, y: 6, typ: npcGenie}})

	sailor := entityID(kindPlayer, 8)
	ashore := fields{x: 30, y: 40, name: "Sam", hp: 10, maxHP: 10, level: 1, boat: boatFields{true, 31.5, 41.25, 90, sailStopped, false}}
	sailing := ashore
	sailing.boat = boatFields{true, 32, 41.5, 45, sailHalf, true}
	isNew("player with a moored boat", view{id: sailor, f: ashore})
	changes("player sails", view{id: sailor, f: sailing, trail: []Vec{{31.5, 41.25}, {32, 41.5}}}, ashore)
	changes("player's boat goes away", view{id: sailor, f: fields{x: 30, y: 40, name: "Sam", hp: 10, maxHP: 10, level: 1}}, sailing)

	drop := entityID(kindDrop, 9)
	lying := fields{x: 8, y: 9, typ: coin, qty: 40, until: 500, publicAt: 400}
	later := lying
	later.until = 600
	isNew("drop", view{id: drop, f: lying})
	changes("drop stays longer", view{id: drop, f: later}, lying)
	return
}

// The wire format only changes on purpose, and the browser is tested with what the server really sends.
func TestRecordedEntities(t *testing.T) {
	names, encoded := encodings()
	recordings := make([]recording, len(names))
	seen := map[protoreflect.Name]bool{}
	for i, b := range encoded {
		recordings[i] = recording{names[i], hex.EncodeToString(b)}
		e := &pb.Entity{}
		check(t, proto.Unmarshal(b, e) == nil, names[i])
		e.ProtoReflect().Range(func(f protoreflect.FieldDescriptor, _ protoreflect.Value) bool {
			seen[f.Name()] = true
			return true
		})
	}
	all := (&pb.Entity{}).ProtoReflect().Descriptor().Fields()
	for i := range all.Len() {
		check(t, seen[all.Get(i).Name()], "no recorded entity has", all.Get(i).Name())
	}
	now, _ := json.MarshalIndent(recordings, "", "  ")
	now = append(now, '\n')
	if *record {
		check(t, os.WriteFile(recordedEntities, now, 0o644) == nil, "cannot write", recordedEntities)
	}
	saved, _ := os.ReadFile(recordedEntities)
	check(t, string(saved) == string(now), recordedEntities, "is out of date. If that is on purpose: npm run record")
}
