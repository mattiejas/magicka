package game

import (
	"encoding/json"
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
				check(t, near == (b.atk.ID != "jet"), b.atk.ID, "near", near)
			}
		}
		prev, started = *b, true
	}
	eq(t, chosen, map[string]bool{"snap": true, "double_snap": true, "jet": true})
}

func TestTelegraphsCanBeDodgedAndRoot(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("colossus")
	e.w.enter(m)
	for _, other := range e.w.monsters { // none of which may join in
		if other != m {
			other.Dead, other.respawnAt = true, math.MaxInt
		}
	}
	dodged, hit, rooted := 0, 0, 0
	for i := range 800 {
		dodge, b := i < 400, m.boss
		e.at(p, m.X-6, m.Y, m.Map.ID)
		if b.st == windup && b.end == e.w.Tick+1 && dodge && slices.Contains(b.tiles, p.at()) {
			e.at(p, m.X-8, m.Y+3, m.Map.ID)
		}
		e.provoke(p, m)
		e.run(1)
		b = m.boss
		if b.st == execute && b.start == e.w.Tick {
			if p.C.HP < 1e6 {
				check(t, !dodge, "dodged attack hit", b.atk.ID)
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

// fight makes a player count as fighting a boss, with a contribution.
func (e *env) fight(p *Player, m *Monster, contribution float64) {
	e.at(p, m.X-1, m.Y, m.Map.ID)
	e.provoke(p, m)
	m.damage.set(p.ID, contribution)
}

func near(a, b float64) bool { return math.Abs(a-b) < 0.005 }

func TestBossHealthScalesBothWays(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	m.HP = m.MaxHP * 0.4
	var ps []*Player
	for i := int64(1); i <= 4; i++ {
		p := e.player(i)
		ps = append(ps, p)
		e.fight(p, m, 0.15)
	}
	e.run(1)
	eq(t, m.MaxHP, 900*2.5) // half of the base for each player after the first
	check(t, near(m.HP/m.MaxHP, 0.4), "percentage lost", m.HP/m.MaxHP)
	for _, p := range ps[2:] {
		e.at(p, 48, 77, "mainland")
		m.active.del(p.ID)
	}
	e.run(1)
	eq(t, m.MaxHP, 900*1.5)
	check(t, near(m.HP/m.MaxHP, 0.4), "percentage lost", m.HP/m.MaxHP)
}

func TestNewcomersDoNotMakeABossTougher(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	m.HP = 500
	e.fight(e.player(1), m, 0.4)
	for i := int64(2); i <= 20; i++ {
		e.fight(e.player(i), m, lootShare)
	}
	e.run(1)
	eq(t, m.MaxHP, 900)
	m.damage.set(PlayerID(2), 0.03)
	e.run(1)
	eq(t, m.MaxHP, 900*1.5)
}

func TestInactiveFightersDropOff(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	m.HP = 400
	a, b := e.player(1), e.player(2)
	for _, p := range []*Player{a, b} {
		e.fight(p, m, 0.2)
		e.at(p, 48, 77, "mainland")
	}
	e.run(1)
	eq(t, m.MaxHP, 900*1.5)
	for range 40 {
		m.active.set(a.ID, e.w.Tick)
		e.run(1)
	}
	eq(t, m.MaxHP, 900)
}

func TestBossHealsSlowlyInAndOutOfAFight(t *testing.T) {
	for _, fighting := range []bool{true, false} {
		e := setup(t)
		e.w.spawnWorldBoss()
		m := e.w.worldBoss()
		m.HP = 450
		p := e.player(1)
		e.fight(p, m, 0.5)
		if !fighting {
			e.at(p, 48, 77, "mainland")
			m.active.clear()
		}
		e.run(Ticks(10))
		want := 450 + 900*0.02 // 0.2% of full health per second
		check(t, math.Abs(m.HP-want) < 2, "fighting", fighting, m.HP)
	}
}

func TestHealingShrinksContribution(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	// A takes the boss to 40% and leaves; by 70%, half of that damage is undone.
	m.HP = 360
	m.damage.set(PlayerID(1), 0.6)
	for i := 0; i < 5000 && m.HP < 630; i++ {
		e.run(1)
	}
	check(t, near(m.damage.get(PlayerID(1)), 0.3), m.damage.get(PlayerID(1)))
	eq(t, m.contributors(), []uint32{PlayerID(1)})
	e.run(1000)
	eq(t, m.HP, m.MaxHP)
	eq(t, m.damage.len(), 0, "nothing is left once fully healed")
}

func TestDyingHalvesContribution(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	p, q := e.player(1), e.player(2)
	m.damage.set(p.ID, 0.1)
	m.damage.set(q.ID, 0.1)
	e.at(p, m.X-1, m.Y, "mainland")
	e.w.hurt(p, m.ID, 9999, attackMelee)
	eq(t, m.damage.get(p.ID), 0.05)
	eq(t, m.damage.get(q.ID), 0.1)
	e.w.hurt(p, m.ID, 9999, attackMelee)
	eq(t, m.damage.get(p.ID), 0.025)
	check(t, len(m.contributors()) == 2, "still above the loot line")
	eq(t, e.monster("gnashclaw").damage.len(), 0)
}

// bossFight lets strong players and newcomers hit the world boss until it dies. It returns the seconds it took, or 0.
func bossFight(t *testing.T, seed uint32, strong, newcomers int) float64 {
	e := setup(t)
	e.w.rnd = Mulberry(seed)
	e.w.spawnWorldBoss()
	m := e.w.worldBoss()
	for i := range strong + newcomers {
		p := e.player(int64(i + 1))
		weapon, level := "adamantite_sword", 50
		if i >= strong {
			weapon, level = "copper_sword", 1
		}
		setLevel(p, level)
		p.C.Equip["weapon"] = &Stack{weapon, 1}
	}
	for tick := 1; tick < 4000; tick++ {
		for _, p := range e.w.order {
			e.at(p, m.X-1, m.Y, "mainland")
			p.C.HP = 1e6
			p.act = action{typ: actAttack, id: m.ID}
		}
		e.run(1)
		if m.Dead {
			return float64(tick) * TickMS / 1000
		}
	}
	return 0
}

func TestGroupsFindBossesEasierAndNewcomersHelp(t *testing.T) {
	average := func(strong, newcomers int) float64 {
		total := 0.0
		for seed := uint32(1); seed <= 6; seed++ {
			total += bossFight(t, seed, strong, newcomers) / 6
		}
		return total
	}
	alone, five, joined := average(1, 0), average(5, 0), average(5, 15)
	t.Logf("seconds to kill: alone %.0f, five %.0f, five with 15 newcomers %.0f", alone, five, joined)
	check(t, alone > 0 && five > 0 && five < alone, "groups", alone, five)
	check(t, joined > 0 && joined <= five*1.05, "newcomers", five, joined)
}

func TestWeakGearCannotOutpaceHealing(t *testing.T) {
	eq(t, bossFight(t, 1, 0, 1), 0)
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
		if o.Item == "ships_wheel" {
			d = o
		}
	}
	e.at(q, d.X, d.Y, "island")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("ships_wheel"), 0)
	check(t, e.c[1].ents[d.ID] != nil && e.c[2].ents[d.ID] == nil, "private loot visibility")
	e.run(301)
	e.at(q, d.X, d.Y, "island")
	q.C.HP = 1e6
	e.run(1)
	check(t, e.c[2].ents[d.ID] != nil, "public loot visibility")
	e.do(q, pickupMsg(d.ID), 2)
	eq(t, q.count("ships_wheel"), 1)
}

func TestUniquesDropNearStatedRate(t *testing.T) {
	const kills = 200_000
	r, uniques, trophies := Mulberry(3), 0, 0
	for range kills {
		for _, l := range rollLoot(r, &content.Monsters["colossus"].Loot) {
			switch {
			case content.Items[l.item].Trophy:
				trophies++
			case l.unique:
				uniques++
			}
		}
	}
	near := func(n, want int) bool { return n > want*8/10 && n < want*12/10 }
	check(t, near(uniques, kills*3/400), uniques)
	check(t, near(trophies, kills/1000), trophies)
}

func TestWorldBossStaysUntilKilled(t *testing.T) {
	e := setup(t)
	e.run(1000)
	m := e.w.worldBoss()
	check(t, !m.Dead)
	m.HP = 500
	e.run(1100) // past the next scheduled spawn
	check(t, !m.Dead && m.HP == 900, "healed, still there")
}

// extraWorldBoss adds another world boss for rotation tests.
func (e *env) extraWorldBoss(name string, x, y int) *Monster {
	base := content.Monsters["colossus"]
	def := *base
	def.ID, def.Name = name, name
	boss := *base.Boss
	def.Boss = &boss
	m := &Monster{
		ID:        entityID(kindMonster, len(e.w.monsters)),
		Def:       &def,
		Map:       content.MapByID["mainland"],
		X:         x,
		Y:         y,
		start:     Point{X: x, Y: y},
		home:      Point{X: x, Y: y},
		Dead:      true,
		respawnAt: math.MaxInt,
	}
	m.restore()
	e.w.monsters = append(e.w.monsters, m)
	return m
}

func lastBossInfo(c *client) string {
	for i := len(c.msgs) - 1; i >= 0; i-- {
		if info := c.msgs[i].GetInfo(); info != nil && info.Kind == pb.InfoKind_INFO_KIND_BOSS {
			return info.Text
		}
	}
	return ""
}

func lastBossStatus(c *client) *pb.BossStatus {
	for i := len(c.msgs) - 1; i >= 0; i-- {
		if b := c.msgs[i].GetBoss(); b != nil {
			return b
		}
	}
	return nil
}

func TestWorldBossArenaNameComesFromTheMap(t *testing.T) {
	e := setup(t)
	e.player(1)
	e.w.spawnWorldBoss()
	eq(t, lastBossInfo(e.c[1]), "Orrumax, the Rooted rises in the Rooted arena on the mainland.")
	e.run(bossBarInterval)
	status := lastBossStatus(e.c[1])
	check(t, status != nil && status.Alive && status.Next == "Orrumax, the Rooted", status)
}

func TestWorldBossesRotateAndNeverRepeat(t *testing.T) {
	e := setup(t)
	first := e.w.worldBoss()
	second := e.extraWorldBoss("Iron titan", 76, 56)
	eq(t, len(e.w.worldBosses()), 2)
	e.player(1)
	e.w.spawnWorldBoss()
	eq(t, e.w.worldBoss(), first)
	check(t, !first.Dead && second.Dead)
	eq(t, lastBossInfo(e.c[1]), "Orrumax, the Rooted rises in the Rooted arena on the mainland.")
	e.w.kill(first)
	eq(t, e.w.worldBoss(), second)
	e.run(bossBarInterval)
	status := lastBossStatus(e.c[1])
	check(t, status != nil && !status.Alive && status.Next == "Iron titan", status)
	e.w.spawnWorldBoss()
	check(t, !second.Dead && first.Dead)
	eq(t, lastBossInfo(e.c[1]), "Iron titan rises in the Iron shelf on the mainland.")
	e.w.kill(second)
	eq(t, e.w.worldBoss(), first)
	// With one world boss the schedule keeps that boss.
	alone := setup(t)
	only := alone.w.worldBoss()
	alone.w.spawnWorldBoss()
	alone.w.kill(only)
	eq(t, alone.w.worldBoss(), only)
	alone.w.spawnWorldBoss()
	check(t, !only.Dead)
}

// --- uniques

func (e *env) dropUnique(owner *Player) *Drop {
	e.w.drop(e.w.mapOf(owner), owner.at(), "rootcleaver", 1, owner.ID, bossLoot)
	return e.w.drops[len(e.w.drops)-1]
}

func TestUnclaimedUniqueGoesToTheReaper(t *testing.T) {
	e := setup(t)
	p, q := e.player(1), e.player(2)
	e.at(p, 20, 44, "island")
	d := e.dropUnique(p)
	for range Ticks(180) - 1 {
		e.at(q, 20, 44, "island")
		e.do(q, pickupMsg(d.ID), 1)
		p.C.HP, q.C.HP = 1e6, 1e6
	}
	eq(t, q.count("rootcleaver"), 0)
	check(t, e.c[2].ents[d.ID] == nil, "others must never see it")
	e.run(2)
	eq(t, len(e.w.drops), 0)
	eq(t, p.C.Kept, []*Stack{{"rootcleaver", 1}})
	e.atStation(p, "reaper", "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("rootcleaver"), 1)
	eq(t, len(p.C.Kept), 0)
}

func TestUniqueIsKeptForSomeoneWhoLeft(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.run(Ticks(30)) // saved at least once
	e.dropUnique(p)
	e.w.Leave(p.ID, e.c[1])
	e.run(Ticks(181))
	check(t, e.w.players[p.ID] == nil)
	var c Char
	check(t, json.Unmarshal(e.saved.chars[1], &c) == nil)
	eq(t, c.Kept, []*Stack{{"rootcleaver", 1}})
}

func TestUniqueSurvivesShutdown(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.dropUnique(p)
	e.w.drop(e.w.mapOf(p), p.at(), "copper_ore", 1, p.ID, bossLoot)
	e.w.SaveAll()
	var c Char
	check(t, json.Unmarshal(e.saved.chars[1], &c) == nil)
	eq(t, c.Kept, []*Stack{{"rootcleaver", 1}})
}

func TestOwnerCanPickUpTheirUnique(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	d := e.dropUnique(p)
	e.do(p, pickupMsg(d.ID), 2)
	eq(t, p.count("rootcleaver"), 1)
	e.run(Ticks(200))
	eq(t, len(p.C.Kept), 0)
}

func TestReaperGivesKeptItemsBeforeTheGrave(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	p.give("ash_log", 24)
	e.w.hurt(p, 0, 999, melee)
	p.C.Kept = []*Stack{{"rootcleaver", 1}}
	p.give("berries", 23)
	e.atStation(p, "reaper", "island")
	e.do(p, claimMsg, 1)
	eq(t, p.count("rootcleaver"), 1)
	eq(t, p.C.Grave.Items, []*Stack{{"ash_log", 24}})
}
