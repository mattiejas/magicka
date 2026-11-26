package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func fightBackMsg(on bool) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_FightBack{FightBack: on}}
}

// hitBy has a monster strike a player who stands beside it.
func (e *env) hitBy(p *Player, m *Monster) {
	p.C.HP = 1e6
	e.w.monsterAttack(m, p)
}

func TestIdlePlayerFightsBack(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	e.hitBy(p, m)
	eq(t, p.act, action{typ: actAttack, id: m.ID})
}

func TestSkillingPlayerFightsBack(t *testing.T) {
	for name, act := range map[string]action{
		"gathering": {typ: actGather, id: 1},
		"crafting":  {typ: actCraft, recipe: content.RecipeByID["ration"], left: 5},
	} {
		e := setup(t)
		p, m := e.player(1), e.monster("boar")
		p.act = act
		e.hitBy(p, m)
		eq(t, p.act, action{typ: actAttack, id: m.ID}, name)
	}
}

func TestMinerHitByAMonsterHitsItBack(t *testing.T) {
	e := setup(t)
	p, m, n := e.player(1), e.monster("boar"), e.node("rock_1", "island")
	setLevel(p, 30)
	e.at(p, n.X, n.Y+1, "island")
	e.do(p, gatherMsg(n.ID), 1)
	e.w.vacate(m)
	m.X, m.Y, m.home = p.C.X+1, p.C.Y, Point{X: p.C.X + 1, Y: p.C.Y}
	e.w.occupy(m)
	m.target = p.ID
	p.C.HP = 1e6
	for range 20 {
		e.run(1)
		if m.damage.get(p.ID) > 0 {
			break
		}
	}
	check(t, m.damage.get(p.ID) > 0, "the miner never hit back")
}

func TestPlayerWhoChoseSomethingElseKeepsDoingIt(t *testing.T) {
	for name, act := range map[string]action{
		"walking":            {typ: actMove},
		"attacking another":  {typ: actAttack, id: 12345},
		"going to the bank":  {typ: actStation, id: 1},
		"picking up an item": {typ: actPickup, id: 1},
	} {
		e := setup(t)
		p, m := e.player(1), e.monster("boar")
		p.act = act
		e.hitBy(p, m)
		eq(t, p.act, act, name)
	}
}

func TestEatingPlayerDoesNotFightBack(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	p.give("ration", 1)
	p.C.HP = 1
	e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_EatSlot{EatSlot: uint32(slotOf(p, "ration"))}}, 0)
	e.w.Step()
	e.hitBy(p, m)
	eq(t, p.act.typ, actNone)
}

func TestTradingPlayerDoesNotFightBack(t *testing.T) {
	e, a, _ := trading(t)
	m := e.monster("boar")
	e.hitBy(a, m)
	check(t, a.act.typ != actAttack, "turned away from a trade")
}

func TestWalkingAwayWinsOverFightingBack(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	e.at(p, 20, 44, "island")
	e.hitBy(p, m)
	e.do(p, move(22, 44), 1)
	check(t, p.act.typ != actAttack, "still attacking")
	check(t, p.at() != Point{X: 20, Y: 44}, "did not walk")
}

func TestFightBackIsOnForEveryCharacter(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	check(t, e.w.self(p).FightBack, "a new character does not fight back")
}

func TestPlayerWithFightBackOffKeepsSkilling(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	e.do(p, fightBackMsg(false), 1)
	eq(t, e.savedChar(1).NoFightBack, true, "the setting is not saved")
	check(t, !e.w.self(p).FightBack, "Self still says fight back")
	p.act = action{typ: actGather, id: 1}
	e.hitBy(p, m)
	eq(t, p.act.typ, actGather)
	e.do(p, fightBackMsg(true), 1)
	e.hitBy(p, m)
	eq(t, p.act.typ, actAttack, "turned back on")
}

func TestChangingFightBackKeepsATradeOpen(t *testing.T) {
	e, a, _ := trading(t)
	e.do(a, fightBackMsg(false), 1)
	check(t, a.trade != nil, "the trade ended")
}

func TestBossAttacksDoNotTurnAPlayer(t *testing.T) {
	e := setup(t)
	m, p := e.monster("gnashclaw"), e.player(1)
	e.at(p, m.X-3, m.Y, m.Map.ID)
	e.provoke(p, m)
	p.act = action{typ: actGather, id: 1}
	m.boss = &bossState{st: execute, atk: &content.Attack{ID: "boulder", Execute: 1, Damage: [2]int{5, 5}}}
	e.w.bossHit(m, p)
	eq(t, p.act.typ, actGather)
}
