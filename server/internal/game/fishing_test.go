package game

import (
	"fmt"
	"math"
	"strings"
	"testing"

	"driftwake/content"
)

func (e *env) spotsOf(kind, m string) (held, places []*Node) {
	for _, n := range e.w.nodes {
		if n.Def.ID == kind && n.Map.ID == m {
			places = append(places, n)
			if n.depletedUntil != away {
				held = append(held, n)
			}
		}
	}
	return
}

// fishUntilItMoves fishes one spot until it moves, and gives what was caught.
func (e *env) fishUntilItMoves(p *Player, n *Node) int {
	e.beside(p, n)
	caught := 0
	for range 2000 {
		if n.depletedUntil == away {
			return caught
		}
		if p.act.typ == actNone {
			e.do(p, gatherMsg(n.ID), 0)
		}
		e.run(1)
		caught += p.count(n.Def.Item)
		p.take(n.Def.Item, p.count(n.Def.Item))
	}
	e.t.Fatal("the spot never moves")
	return 0
}

func TestFishingSpotsLieOnWaterBesideTheShore(t *testing.T) {
	e := setup(t)
	for _, n := range e.w.nodes {
		if n.Def.Kind != "spot" {
			continue
		}
		shore := false
		for y := n.Y; y < n.Y+n.Def.Size; y++ {
			for x := n.X; x < n.X+n.Def.Size; x++ {
				check(t, isWater(n.Map, x, y), n.Def.ID, x, y)
				for _, d := range dirs[:4] {
					shore = shore || (RectDist(x+d.X, y+d.Y, n.rect()) > 0 && n.Map.CanStandOn(x+d.X, y+d.Y))
				}
			}
		}
		check(t, shore, n.Def.ID, "can be fished from land", n.X, n.Y)
	}
}

func TestFishingSpotsAreNearCampAndOnTheMainland(t *testing.T) {
	island := content.MapByID["island"]
	tiers := map[string]map[int]bool{"island": {}, "mainland": {}, "sea": {}}
	for _, m := range content.Maps {
		for _, n := range m.Nodes {
			if d := content.Nodes[n.Type]; d.Moves {
				tiers[m.ID][d.Tier] = true
			}
		}
	}
	eq(t, len(tiers["island"]), 2)
	check(t, tiers["island"][1] && tiers["island"][2])
	for tier := 2; tier <= 5; tier++ {
		check(t, tiers["mainland"][tier], tier)
	}
	e := setup(t)
	near := false
	for _, n := range e.w.nodes {
		if n.Def.ID == "spot_1" && n.Map == island {
			near = near || math.Hypot(float64(n.X-island.Safe.X), float64(n.Y-island.Safe.Y)) < 30
		}
	}
	check(t, near, "beside camp")
}

func TestOnlySomePlacesHoldASpot(t *testing.T) {
	e := setup(t)
	for _, n := range e.w.nodes {
		if !n.Def.Moves {
			continue
		}
		held := 0
		for _, o := range n.places {
			if o.depletedUntil != away {
				held++
			}
		}
		check(t, len(n.places) > 1, n.Def.ID, "has somewhere to move to")
		eq(t, held, int(math.Ceil(float64(len(n.places))*spotShare)), n.Def.ID)
	}
}

func TestFishingSpotsMoveAlongTheShoreAfterAFewCatches(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	held, places := e.spotsOf("spot_1", "island")
	total := 0
	for range 20 {
		n := held[0]
		total += e.fishUntilItMoves(p, n)
		now, _ := e.spotsOf("spot_1", "island")
		eq(t, len(now), len(held), "as many spots as before")
		check(t, n.depletedUntil == away, "the place it left is empty")
		held = now
	}
	catches := float64(total) / 20
	check(t, catches > 2 && catches < 10, catches)
	check(t, len(places) > len(held))
}

func TestShoalsNeverMoveAndAreSlow(t *testing.T) {
	count := func(kind string) int {
		e := setup(t)
		p := e.player(1)
		setLevel(p, 20)
		n := e.node(kind, "mainland")
		e.beside(p, n)
		total := 0
		for range 3000 {
			if n.depletedUntil == away { // the spot is kept in place, to compare like with like
				n.depletedUntil = 0
			}
			if p.act.typ != actGather {
				e.do(p, gatherMsg(n.ID), 0)
			}
			e.run(1)
			total += p.count("raw_trout")
			p.take("raw_trout", p.count("raw_trout"))
		}
		return total
	}
	big, usual := count("shoal_2"), count("spot_2")
	ratio := float64(big) / float64(usual)
	check(t, ratio > 0.25 && ratio < 0.45, big, usual)
	e := setup(t)
	n := e.node("shoal_1", "mainland")
	check(t, n.depletedUntil == 0 && n.places == nil, "a shoal is always there")
}

func TestShoalsNeedLevelFifteen(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	setLevel(p, 14)
	n := e.node("shoal_1", "mainland")
	e.beside(p, n)
	e.do(p, gatherMsg(n.ID), 60)
	eq(t, p.count("raw_perch"), 0)
}

func TestFishingNeedsARod(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	held, _ := e.spotsOf("spot_1", "island")
	p.take("worn_rod", 1)
	e.beside(p, held[0])
	e.do(p, gatherMsg(held[0].ID), 30)
	eq(t, p.count("raw_perch"), 0)
	eq(t, p.act.typ, actNone)
	check(t, strings.Contains(withArticle("rod"), "fishing rod"))
}

// Until rods come by tier, the worn rod catches every fish.
func TestAWornRodCatchesEveryFish(t *testing.T) {
	for tier := 1; tier <= 5; tier++ {
		e := setup(t)
		p := e.player(1)
		setLevel(p, content.Nodes[fmt.Sprintf("spot_%d", tier)].Level)
		held, _ := e.spotsOf(fmt.Sprintf("spot_%d", tier), map[bool]string{true: "island", false: "mainland"}[tier == 1])
		clear(p.C.Inv)
		p.give("worn_rod", 1)
		p.C.HP = 1e6
		e.beside(p, held[0])
		e.do(p, gatherMsg(held[0].ID), 100)
		check(t, p.count(held[0].Def.Item) > 0, tier)
	}
}

func TestRawFishHealsNothingAndIsWorthSomething(t *testing.T) {
	for _, d := range content.Nodes {
		if d.Kind != "spot" {
			continue
		}
		fish := content.Items[d.Item]
		check(t, strings.HasPrefix(fish.ID, "raw_"), fish.ID)
		eq(t, fish.Heal, 0, fish.ID)
		check(t, fish.Value > 0, fish.ID)
		eq(t, d.Skill, "fishing")
	}
}

func TestTheShopSellsAWornRod(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.take("worn_rod", 1)
	p.give("coin", 100)
	e.atStation(p, "shop", "island")
	e.do(p, shopMsg(true, "worn_rod", 1), 1)
	eq(t, p.count("worn_rod"), 1)
}

func TestNewCharactersCarryARod(t *testing.T) {
	eq(t, NewChar().Inv[2].ID, "worn_rod")
}
