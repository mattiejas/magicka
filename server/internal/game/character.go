package game

import (
	"encoding/json"
	"log"

	"driftwake/server/internal/pb"
)

// This is where changes to characters end up. A rule changes p.C of a player as it likes, and has nothing to do for
// Self or quests: the end of the tick sees to both. It calls save when the change must survive a crash, because
// otherwise it waits for the next one, up to saveInterval. For someone who may not be in the world it calls change.

// save keeps a player's character as it is now.
func (w *World) save(p *Player) { w.saveTogether(p) }

// saveTogether saves players so that a crash cannot keep one change without the other.
func (w *World) saveTogether(players ...*Player) {
	batch := make(map[int64][]byte, len(players))
	for _, p := range players {
		b, err := json.Marshal(p.C)
		if err != nil {
			log.Printf("saving %s: %v", p.Name, err)
			return
		}
		batch[p.Account] = b
	}
	w.store.Save(batch)
}

// change changes and saves a character, in the world or in the store. It returns the player if they are here.
// what says what is being done, for the log.
func (w *World) change(id uint32, what string, change func(*Char)) *Player {
	if p := w.players[id]; p != nil {
		change(p.C)
		w.save(p)
		return p
	}
	if err := w.store.Update(accountOf(id), change); err != nil {
		log.Printf("%s for account %d: %v", what, accountOf(id), err)
	}
	return nil
}

// giveOrKeep gives what fits. The reaper keeps the rest, which is how many it returns.
func (p *Player) giveOrKeep(id string, qty int) (kept int) {
	if kept = qty - p.give(id, qty); kept > 0 {
		p.C.Kept = addTo(p.C.Kept, id, kept)
	}
	return kept
}

// sendSelf tells a player about their character, unless they know it as it is.
func (w *World) sendSelf(p *Player) {
	if p.told != nil && p.isCurrent(p.told) {
		return
	}
	p.told = w.self(p)
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Self{Self: p.told}})
}
