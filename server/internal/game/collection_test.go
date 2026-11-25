package game

import (
	"encoding/json"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// always rolls every rare and unique drop.
func always() float64 { return 0 }

// never rolls any rare or unique drop. Below 1 so common picks stay in range.
func never() float64 { return 0.999 }

func TestBossDropsAreLoggedPerBoss(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.w.rnd = always
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	want := map[string]int{"gnashclaw/gem_1": 1, "gnashclaw/gem_2": 1, "gnashclaw/barnacle_charm": 1}
	eq(t, p.C.Found, want)
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	eq(t, p.C.Found["gnashclaw/barnacle_charm"], 2)
	e.run(1)
	var sent uint32
	for _, m := range e.c[1].msgs {
		if self := m.GetSelf(); self != nil {
			sent = self.Found["gnashclaw/barnacle_charm"]
		}
	}
	eq(t, sent, uint32(2))
}

func TestBossKillsAreCountedPerBoss(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.w.rnd = never // no collectible finds, but the kill still earned loot
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	e.w.dropLoot(e.monster("deepstone"), p.ID)
	eq(t, p.C.Kills, map[string]int{"gnashclaw": 2, "deepstone": 1})
	eq(t, len(p.C.Found), 0)
	e.run(1)
	var sent uint32
	for _, m := range e.c[1].msgs {
		if self := m.GetSelf(); self != nil {
			sent = self.Kills["gnashclaw"]
		}
	}
	eq(t, sent, uint32(2))
}

func TestOrdinaryMonstersAreNotLogged(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.w.rnd = always
	for _, m := range e.w.monsters {
		if m.Def.Boss == nil {
			e.w.dropLoot(m, p.ID)
		}
	}
	eq(t, len(p.C.Found), 0)
	eq(t, len(p.C.Kills), 0)
}

func TestFindsAreLoggedForSomeoneWhoLeft(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(Ticks(30)) // saved at least once
	e.w.Leave(p.ID, e.c[1])
	e.run(Ticks(60))
	check(t, e.w.players[p.ID] == nil)
	e.w.rnd = always
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	var c Char
	check(t, json.Unmarshal(e.saved.chars[1], &c) == nil)
	eq(t, c.Found["gnashclaw/barnacle_charm"], 1)
	eq(t, c.Kills["gnashclaw"], 1)
}

func TestKillsAreCountedForSomeoneWhoLeft(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(Ticks(30))
	e.w.Leave(p.ID, e.c[1])
	e.run(Ticks(60))
	check(t, e.w.players[p.ID] == nil)
	e.w.rnd = never
	e.w.dropLoot(e.monster("gnashclaw"), p.ID)
	var c Char
	check(t, json.Unmarshal(e.saved.chars[1], &c) == nil)
	eq(t, c.Kills["gnashclaw"], 1)
	eq(t, len(c.Found), 0)
}

func TestTheCollectionLogIsPrivate(t *testing.T) {
	entity := (&pb.Entity{}).ProtoReflect().Descriptor().Fields()
	check(t, entity.ByName("found") == nil)
	check(t, entity.ByName("kills") == nil)
	self := (&pb.Self{}).ProtoReflect().Descriptor().Fields()
	check(t, self.ByName("found") != nil)
	check(t, self.ByName("kills") != nil)

	e := setup(t)
	owner, other := e.player(1), e.player(2)
	owner.C.Found = map[string]int{"gnashclaw/barnacle_charm": 1}
	owner.C.Kills = map[string]int{"gnashclaw": 4}
	e.run(1)
	for _, m := range e.c[2].msgs {
		if self := m.GetSelf(); self != nil {
			eq(t, self.Id, other.ID)
			eq(t, len(self.Found), 0)
			eq(t, len(self.Kills), 0)
		}
	}
}

func TestTradedAndPickedUpItemsAreNotFinds(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give("rootcleaver", 1)
	p.C.fill()
	d := e.dropUnique(p)
	e.do(p, pickupMsg(d.ID), 2)
	eq(t, len(p.C.Found), 0)
}

func TestCapesAreLoggedOnce(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.XP["mining"] = xpTable[MaxLevel]
	e.w.grantCapes(p)
	e.w.grantCapes(p)
	p.C.fill()
	eq(t, p.C.Found, map[string]int{"skills/cape_mining": 1})
}

func TestTrophiesFromBeforeTheLogAreKnown(t *testing.T) {
	c := NewChar()
	c.Bank = addTo(c.Bank, "rooted_mantle", 1)
	c.Kept = addTo(c.Kept, "cape_magic", 1)
	c.Bank = addTo(c.Bank, "heartwood", 1) // may have been traded for
	for range 2 {
		c.fill()
	}
	eq(t, c.Found, map[string]int{"colossus/rooted_mantle": 1, "skills/cape_magic": 1})
}

func TestEveryBossHasSomethingToCollect(t *testing.T) {
	for _, m := range content.Monsters {
		if m.Boss != nil {
			check(t, len(m.Loot.Unique) > 0, m.ID)
		}
	}
}
