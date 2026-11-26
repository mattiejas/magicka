package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func questMsg(id string) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_StartQuest{StartQuest: id}}
}

func npcMsg(n *NPC) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Npc{Npc: n.ID}}
}

func sellToTraderMsg(n uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_SellToTrader{SellToTrader: n}}
}

func TestStrandedGuidesToTheBoat(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 44, "island")
	e.do(p, questMsg("stranded"), 1)
	eq(t, len(p.C.Quests), 0, "only at the shipwright")
	e.atStation(p, "dock", "island")
	e.do(p, questMsg("stranded"), 1)
	step := func(want int) {
		t.Helper()
		e.run(1)
		eq(t, p.C.Quests["stranded"], want)
	}
	step(0)
	e.w.addXP(p, "mining", 25)
	step(1)
	bring := func(item string, qty int) {
		p.give(item, qty)
		e.do(p, boatMsg(false), 1)
	}
	bring("ash_log", 20)
	step(2)
	bring("copper_bar", 8)
	step(3)
	bring("fibre_1", 12)
	step(4)
	p.give("copper_sword", 1)
	step(5)
	p.give("ration", 1)
	step(6)
	p.take("ration", 1)
	step(6)
	p.give("ships_wheel", 1)
	step(7)
	e.do(p, boatMsg(false), 1)
	step(8)
	check(t, p.C.BoatDone)
	eq(t, p.count(coin), 300)
	e.run(5)
	eq(t, p.count(coin), 300, "paid once")
	eq(t, len(content.Quests[0].Steps), 8)
}

func TestTheBoatNeedsNoQuest(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.BoatDone = true
	e.atStation(p, "dock", "island")
	e.do(p, questMsg("stranded"), 1)
	eq(t, len(p.C.Quests), 0, "too late to be stranded")
}

func TestGenieVisitsOncePerThreeHoursOfPlay(t *testing.T) {
	e := setup(t)
	p, q := e.player(1), e.player(2)
	p.C.PlayTicks = genieInterval - 1
	e.do(p, chatMsg("hi"), 0)
	for e.w.Tick%genieCheck != 0 || e.w.Tick == 0 {
		e.run(1)
	}
	eq(t, len(e.w.npcs), 1)
	n := e.w.npcs[0]
	eq(t, n.owner, p.ID)
	check(t, e.c[1].ents[n.ID] != nil && e.c[2].ents[n.ID] == nil, "only its owner sees it")
	e.do(q, npcMsg(n), 3)
	eq(t, q.count(lamp), 0)
	e.do(p, npcMsg(n), 3)
	eq(t, p.count(lamp), 1)
	eq(t, len(e.w.npcs), 0)
	e.do(p, chatMsg("again"), 2*genieCheck)
	eq(t, len(e.w.npcs), 0)
}

func TestGenieLeavesAndSkipsTheIdle(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.PlayTicks = 2 * genieInterval
	e.run(activeTime + 2*genieCheck)
	p.C.GenieAt = 0
	for _, n := range e.w.npcs {
		n.until = 0
	}
	e.run(1)
	played := p.C.PlayTicks
	e.run(3 * genieCheck)
	eq(t, len(e.w.npcs), 0)
	eq(t, p.C.PlayTicks, played, "idling is not playing")
	e.w.sendGenie(p)
	e.run(genieStay + 1)
	eq(t, len(e.w.npcs), 0)
}

func TestLampTrainsAChosenSkill(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give(lamp, 1)
	use := func(skill string) {
		e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_UseLamp{UseLamp: skill}}, 1)
	}
	use("baking")
	eq(t, p.count(lamp), 1)
	use("magic")
	eq(t, p.C.XP["magic"], round(LampXP(1)))
	use("magic")
	eq(t, p.C.XP["magic"], round(LampXP(1)))
	check(t, !content.Items[lamp].Tradable())
}

func TestRichVeinGivesDoubleAndLasts(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, 50)
	clear(p.C.Inv)
	p.give("adamantite_pickaxe", 1)
	e.w.startVein()
	var n *Node
	for _, o := range e.w.nodes {
		if o.isRich(e.w.Tick) {
			n = o
		}
	}
	e.beside(p, n)
	for range veinTime - 5 {
		p.C.HP = 1e6
		if p.emptySlot() < 0 || p.act.typ != actGather {
			for i := 1; i < len(p.C.Inv); i++ {
				p.C.Inv[i] = nil
			}
			e.do(p, gatherMsg(n.ID), 0)
		}
		before := p.count(n.Def.Item)
		e.run(1)
		got := p.count(n.Def.Item) - before
		check(t, got == 0 || got == veinYield || p.emptySlot() < 0, got)
		check(t, n.depletedUntil <= e.w.Tick)
	}
	check(t, p.count(n.Def.Item) > 0)
	e.run(10)
	check(t, !n.isRich(e.w.Tick))
}

func TestStrandedTraderPaysDoubleUpToALimit(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	clear(p.C.Inv)
	e.w.startTrader()
	n := e.w.npcs[0]
	p.C.Bank = nil
	e.at(p, 48, 77, "mainland")
	p.give(n.wants, 3)
	e.do(p, sellToTraderMsg(3), 1)
	eq(t, p.count(coin), 0, "from afar")
	e.at(p, n.X, n.Y, "mainland")
	e.do(p, sellToTraderMsg(3), 1)
	value := content.Items[n.wants].Value
	eq(t, p.count(coin), 3*2*value)
	for range 10 {
		p.give(n.wants, 20)
		e.do(p, sellToTraderMsg(20), 1)
		p.C.HP = 1e6
	}
	eq(t, p.count(coin), traderLimit*2*value)
	e.run(traderTime)
	eq(t, len(e.w.npcs), 0)
}

func TestTraderSpawnsOutOfReach(t *testing.T) {
	e := setup(t)
	m := content.MapByID[encounterMap]
	var besideGolem []Point
	raw := 0
	for y, row := range m.Rows {
		for x := range row {
			if row[x] != dirt || !m.Walkable(x, y) || !m.Walkable(x+1, y) || e.w.inTown(m, x, y) {
				continue
			}
			raw++
			for _, mon := range e.w.monsters {
				if mon.Def.ID != "golem" {
					continue
				}
				if RectDist(mon.home.X, mon.home.Y, tile(x, y)) < wanderRange+mon.Def.Aggro {
					besideGolem = append(besideGolem, Point{X: x, Y: y})
					break
				}
			}
		}
	}
	check(t, len(besideGolem) > 0, "expected road tiles next to golems")
	spots := e.w.traderSpots()
	check(t, len(spots) > 0 && len(spots) < raw, len(spots), raw)
	for _, at := range besideGolem {
		for _, s := range spots {
			check(t, s.X != at.X || s.Y != at.Y, "road beside golem", at.X, at.Y)
		}
	}
	for _, s := range spots {
		check(t, e.w.outOfReach(m, tile(s.X, s.Y)), s.X, s.Y)
	}
}

func TestStampedeCrossesAndIsGone(t *testing.T) {
	e := setup(t)
	herd := func() (out []*Monster) {
		for _, m := range e.w.monsters {
			if m.Def.Herd && !m.Dead {
				out = append(out, m)
			}
		}
		return
	}
	eq(t, len(herd()), 0)
	e.w.startStampede()
	all := herd()
	eq(t, len(all), stampedeBoars+1)
	e.run(20)
	check(t, all[0].X > stampedeFrom+12, all[0].X)
	e.w.kill(all[1])
	e.run(stampedeTime)
	eq(t, len(herd()), 0)
	e.run(200)
	eq(t, len(herd()), 0, "they do not come back by themselves")
	e.w.startStampede()
	eq(t, len(herd()), stampedeBoars+1)
}

func TestEncountersNeedSomeoneOnTheMainland(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	happening := func() bool {
		if len(e.w.npcs) > 0 {
			return true
		}
		for _, n := range e.w.nodes {
			if n.isRich(e.w.Tick) {
				return true
			}
		}
		return e.w.stampedeEnds > e.w.Tick
	}
	e.run(Ticks(encounterMax) + 2)
	check(t, !happening())
	e.at(p, 48, 77, "mainland")
	for range Ticks(encounterMax) + 2 {
		e.run(1)
		if happening() {
			return
		}
	}
	t.Fatal("nothing happened")
}

func TestTheMineIsEnteredAndLeft(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	use := func(m string) {
		e.atStation(p, "mine", m)
		if m == "mine" {
			e.at(p, 24, 43, m)
		}
		for i, s := range e.w.stations {
			if s.m.ID == m && s.s.Type == "mine" {
				e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_Station{Station: entityID(kindStation, i)}}, 2)
			}
		}
	}
	use("mainland")
	eq(t, p.C.Map, "mine")
	use("mine")
	eq(t, p.C.Map, "mainland")
	check(t, e.w.mapOf(p).Walkable(p.C.X, p.C.Y))
	use("mainland")
	p.give("copper_ore", 1)
	e.w.hurt(p, 0, 9999, melee)
	eq(t, p.C.Map, "mainland", "they wake up in town")
	eq(t, p.C.Grave.Map, "mine")
}

func TestDeepstoneDropsOre(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	m := e.monster("deepstone")
	e.at(p, m.X, m.Y+2, "mine")
	p.C.HP = 1e6
	e.w.damageMonster(p, m, int(m.MaxHP)+1, melee)
	found := 0
	for _, d := range e.w.drops {
		if d.Item == "mithril_ore" {
			found += d.Qty
		}
	}
	check(t, found >= 3)
	e.run(Ticks(m.Def.Respawn) + 1)
	check(t, !m.Dead)
}
