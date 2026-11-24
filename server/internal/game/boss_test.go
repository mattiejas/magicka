package game

import (
	"math"
	"slices"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func TestBossOnlyCyclesThreeStates(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	var prev bossState
	started := false
	chosen := map[string]bool{}
	next := map[pb.BossState]pb.BossState{choose: windup, windup: execute, execute: choose}
	for i := range 1500 {
		near := i/150%2 == 0
		x := m.X - 6
		if near {
			x = m.X - 1
		}
		e.at(p, x, m.Y, "island")
		e.provoke(p, m)
		e.run(1)
		b := m.boss
		if started {
			if prev.st == windup && b.st == windup {
				check(t, b.atk == prev.atk && slices.Equal(b.tiles, prev.tiles), "attack changed")
			}
			if prev.st != b.st {
				eq(t, b.st, next[prev.st])
			}
			if prev.st == choose && b.st == windup {
				chosen[b.atk.ID] = true
				check(t, near || b.atk.ID != "melee", "melee out of reach")
			}
		}
		prev, started = *b, true
	}
	eq(t, chosen, map[string]bool{"melee": true, "boulder": true, "vines": true})
}

func TestTelegraphsCanBeDodgedAndRoot(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("gnashclaw")
	dodged, hit, rooted := 0, 0, 0
	for i := range 800 {
		dodge, b := i < 400, m.boss
		e.at(p, m.X-6, m.Y, "island")
		if b.st == windup && b.end == e.w.Tick+1 && dodge && b.atk.ID != "melee" {
			e.at(p, m.X-8, m.Y+3, "island")
		}
		e.provoke(p, m)
		e.run(1)
		b = m.boss
		if b.st == execute && b.start == e.w.Tick {
			if p.C.HP < 1e6 {
				check(t, !dodge, "dodged attack hit")
				hit++
			} else {
				dodged++
			}
			if p.rooted > e.w.Tick {
				rooted++
			}
		}
	}
	check(t, dodged > 10 && hit > 10 && rooted > 0, dodged, hit, rooted)
}

func TestBossHealthScalesBothWays(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	var ps []*Player
	for i := int64(1); i <= 4; i++ {
		p := e.player(i)
		ps = append(ps, p)
		e.at(p, m.X-1, m.Y, "mainland")
		e.provoke(p, m)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 4))
	m.HP = m.MaxHP * 0.4
	for _, p := range ps[2:] {
		e.at(p, 48, 77, "mainland")
		m.active.del(p.ID)
	}
	for _, p := range ps[:2] {
		e.at(p, m.X-1, m.Y, "mainland")
		e.provoke(p, m)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 2))
	check(t, math.Abs(m.HP/m.MaxHP-0.4) < 1e-9)
}

func TestInactiveFightersDropOff(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	a, b := e.player(1), e.player(2)
	for _, p := range []*Player{a, b} {
		e.at(p, 48, 77, "mainland")
		m.active.set(p.ID, e.w.Tick)
	}
	e.run(1)
	eq(t, m.MaxHP, BossMaxHP(900, 2))
	for range 40 {
		m.active.set(a.ID, e.w.Tick)
		e.run(1)
	}
	eq(t, m.MaxHP, 900)
}

func TestBossLootGoesToContributorsThenEveryone(t *testing.T) {
	e := setup(t)
	p, q, m := e.player(1), e.player(2), e.monster("gnashclaw")
	setLevel(p, 50)
	p.C.Equip["weapon"] = &Stack{"rootcleaver", 1}
	m.damage.set(q.ID, 0.01)
	m.damage.set(p.ID, 0.5)
	eq(t, m.contributors(), []uint32{p.ID})
	for i := 0; i < 200 && !m.Dead; i++ {
		e.at(p, m.X-1, m.Y, "island")
		p.act = action{typ: actAttack, id: m.ID}
		p.C.HP = 1e6
		e.run(1)
	}
	check(t, m.Dead)
	var d *Drop
	for _, o := range e.w.drops {
		eq(t, o.Owner, p.ID)
		if o.Item == "rudder" {
			d = o
		}
	}
	e.at(q, d.X, d.Y, "island")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("rudder"), 0)
	check(t, e.c[1].ents[d.ID] != nil && e.c[2].ents[d.ID] == nil, "private loot visibility")
	e.run(301)
	e.at(q, d.X, d.Y, "island")
	q.C.HP = 1e6
	e.run(1)
	check(t, e.c[2].ents[d.ID] != nil, "public loot visibility")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("rudder"), 1)
}

func TestUniquesDropNearStatedRate(t *testing.T) {
	r, n := Mulberry(3), 0
	for range 40000 {
		for _, l := range rollLoot(r, &content.Monsters["colossus"].Loot) {
			if l.unique {
				n++
			}
		}
	}
	check(t, n > 2600 && n < 3400, n)
}

func TestWorldBossScheduleAndAbandonment(t *testing.T) {
	e := setup(t)
	e.run(1000)
	m := e.w.worldBoss()
	check(t, !m.Dead)
	m.damage.set(99, 0.5)
	m.HP = 10
	e.run(2)
	eq(t, m.HP, 900)
}

// A level 8 player in copper with six rations.
func solo(t *testing.T, seed int64, dodge bool) bool {
	e := setup(t)
	e.w.rnd = Mulberry(uint32(seed))
	p, m := e.player(50+seed), e.monster("gnashclaw")
	setLevel(p, 8)
	armour := map[string]string{
		"weapon": "copper_sword", "body": "copper_plate", "legs": "copper_greaves", "head": "copper_helm",
	}
	for slot, id := range armour {
		p.C.Equip[slot] = &Stack{id, 1}
	}
	p.give("ration", 6)
	e.at(p, m.X-1, m.Y, "island")
	for range 900 {
		b, hot := m.boss, false
		for _, q := range b.tiles {
			hot = hot || b.st == windup && q == Point{X: p.C.X, Y: p.C.Y}
		}
		if food := slotOf(p, "ration"); p.C.HP < 20 && food >= 0 {
			e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_EatSlot{EatSlot: uint32(food)}}, 0)
		}
		if dodge && hot {
			e.do(p, move(uint32(p.C.X-3), uint32(p.C.Y)), 0)
		} else if p.act.typ != actAttack && !(dodge && b.st == windup && b.atk.ID != "melee") {
			e.do(p, attackMsg(m.ID), 0)
		}
		e.run(1)
		if m.Dead {
			return true
		}
		if p.C.Grave != nil {
			return false
		}
	}
	return false
}

func TestMiniBossRewardsDodging(t *testing.T) {
	a, b := 0, 0
	for s := int64(1); s <= 30; s++ {
		if solo(t, s, true) {
			a++
		}
		if solo(t, s, false) {
			b++
		}
	}
	t.Logf("mini boss solo wins of 30: dodging %d, standing still %d", a, b)
	check(t, a >= 24 && a > b+10, a, b)
}
