package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func pickupAllMsg(id uint32) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_PickupAll{PickupAll: id}}
}

// told counts the times a player was told text.
func told(c *client, text string) (n int) {
	for _, m := range c.msgs {
		if m.GetInfo().GetText() == text {
			n++
		}
	}
	return
}

func TestTakingAllTakesEverythingOnTheTile(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 40, "island")
	m, at := e.w.mapOf(p), Point{X: 24, Y: 40}
	e.w.drop(m, at, "copper_ore", 2, p.ID, monsterLoot)
	e.w.drop(m, at, "coin", 5, p.ID, monsterLoot)
	e.w.drop(m, Point{X: 25, Y: 40}, "ash_log", 1, p.ID, monsterLoot)
	e.do(p, pickupAllMsg(e.w.drops[0].ID), 20)
	eq(t, p.count("copper_ore"), 2)
	eq(t, p.count("coin"), 5)
	eq(t, p.count("ash_log"), 0, "the next tile is left alone")
	eq(t, len(e.w.drops), 1)
}

func TestTakingAllLeavesWhatThePlayerMayNotTake(t *testing.T) {
	e := setup(t)
	p, other := e.player(1), e.player(2)
	e.at(p, 20, 40, "island")
	e.w.drop(e.w.mapOf(p), p.at(), "copper_ore", 1, p.ID, monsterLoot)
	e.w.drop(e.w.mapOf(p), p.at(), "ash_log", 1, other.ID, monsterLoot)
	e.do(p, pickupAllMsg(e.w.drops[0].ID), 2)
	eq(t, p.count("copper_ore"), 1)
	eq(t, p.count("ash_log"), 0, "another player's loot is still private")
	eq(t, len(e.w.drops), 1)
}

func TestTakingAllWithAFullInventoryTakesTheMostValuableAndSaysSoOnce(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 40, "island")
	clear(p.C.Inv)
	p.give("ash_log", content.InvSize-2)
	m := e.w.mapOf(p)
	e.w.drop(m, p.at(), "copper_ore", 3, p.ID, monsterLoot) // three drops, since ore does not stack
	e.w.drop(m, p.at(), "rootcleaver", 1, p.ID, bossLoot)
	e.do(p, pickupAllMsg(e.w.drops[0].ID), 2)
	eq(t, p.count("rootcleaver"), 1, "the unique comes first")
	eq(t, p.count("copper_ore"), 1)
	eq(t, len(e.w.drops), 2)
	eq(t, told(e.c[1], "Your inventory is full."), 1)
}

func TestTakingAllAddsToStacksAlreadyCarried(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.at(p, 20, 40, "island")
	clear(p.C.Inv)
	p.give("coin", 1)
	p.give("ash_log", content.InvSize-1)
	e.w.drop(e.w.mapOf(p), p.at(), "copper_ore", 1, p.ID, monsterLoot)
	e.w.drop(e.w.mapOf(p), p.at(), "coin", 4, p.ID, monsterLoot)
	e.do(p, pickupAllMsg(e.w.drops[0].ID), 2)
	eq(t, p.count("coin"), 5, "coins fit on the stack carried")
	eq(t, p.count("copper_ore"), 0)
	eq(t, len(e.w.drops), 1)
}
