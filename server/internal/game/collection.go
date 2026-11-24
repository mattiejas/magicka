package game

import (
	"log"
	"slices"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// skillSource is where capes come from in the collection log. Every other source is a boss's id.
const skillSource = "skills"

func logKey(source, item string) string { return source + "/" + item }

// collectible reports whether a boss's drop belongs in the collection log.
// What it always or commonly drops is material, found just as well elsewhere.
func collectible(m *content.Monster, item string) bool {
	if m.Boss == nil {
		return false
	}
	return slices.ContainsFunc(m.Loot.Rare, func(r content.Rare) bool { return r.Item == item }) ||
		slices.ContainsFunc(m.Loot.Unique, func(u content.Unique) bool { return u.Item == item })
}

// logFind counts something found and reports whether it was the first.
func (c *Char) logFind(source, item string) (first bool) {
	if c.Found == nil {
		c.Found = map[string]int{}
	}
	key := logKey(source, item)
	c.Found[key]++
	return c.Found[key] == 1
}

// logOwnedTrophies fills in trophies from before there was a log. Anything else could have been traded for.
func (c *Char) logOwnedTrophies() {
	log := func(source, item string) {
		if content.Items[item].Trophy && c.Found[logKey(source, item)] == 0 && c.owns(item) {
			c.logFind(source, item)
		}
	}
	for _, skill := range content.Skills {
		log(skillSource, "cape_"+skill)
	}
	for _, m := range content.Monsters {
		if m.Boss == nil {
			continue
		}
		for _, u := range m.Loot.Unique {
			log(m.ID, u.Item)
		}
	}
}

// logLoot records what a boss dropped for a winner, whether or not they are here or ever pick it up.
func (w *World) logLoot(m *content.Monster, winner uint32, loot []rolled) {
	var found []string
	for _, l := range loot {
		if collectible(m, l.item) {
			found = append(found, l.item)
		}
	}
	if len(found) == 0 {
		return
	}
	p := w.players[winner]
	if p == nil {
		record := func(c *Char) {
			for _, item := range found {
				c.logFind(m.ID, item)
			}
		}
		if err := w.store.Update(accountOf(winner), record); err != nil {
			log.Printf("logging finds for account %d: %v", accountOf(winner), err)
		}
		return
	}
	for _, item := range found {
		if p.C.logFind(m.ID, item) {
			w.info(p, "New in your collection log: "+content.Items[item].Name+".", pb.InfoKind_INFO_KIND_UNIQUE)
		}
	}
	p.dirty = true
	w.save(p)
}
