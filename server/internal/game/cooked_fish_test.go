package game

import (
	"fmt"
	"strings"
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// cookFish puts a player at the camp fire with some raw fish of a tier and a cooking level.
func (e *env) cookFish(tier, level, fish int) (*Player, *content.Recipe) {
	p := e.cook(level, 0)
	r := content.RecipeByID[cookedFish(tier)]
	p.give(r.In[0].Item, fish)
	return p, r
}

func cookedFish(tier int) string { return "cooked_" + strings.TrimPrefix(rawFish(tier), "raw_") }

// rawFish is what a fishing spot of a tier catches.
func rawFish(tier int) string { return content.Nodes[fmt.Sprintf("spot_%d", tier)].Item }

func TestEachFishIsCookedAtTheLevelItIsCaught(t *testing.T) {
	heal := content.Items["berries"].Heal
	for tier := 1; tier <= 5; tier++ {
		r := content.RecipeByID[cookedFish(tier)]
		check(t, r != nil, tier)
		eq(t, []string{r.Station, r.Skill, r.In[0].Item}, []string{"fire", "cooking", rawFish(tier)}, tier)
		eq(t, r.Level, content.Nodes[fmt.Sprintf("spot_%d", tier)].Level, "the fish's fishing level", tier)
		cooked := content.Items[r.Out]
		check(t, cooked.Heal > heal, "higher tiers heal more", tier)
		check(t, cooked.Heal < content.Items["feast"].Heal, "less than a feast, which takes four things", tier)
		check(t, cooked.Value > content.Items[rawFish(tier)].Value, "worth more cooked than raw", tier)
		heal = cooked.Heal
	}
}

func TestCookedFishNeedsItsLevel(t *testing.T) {
	e := setup(t)
	e.w.rnd = func() float64 { return 0.99 } // and never burns it
	p, perch := e.cookFish(1, 1, 1)
	e.do(p, cookMsg(perch.ID, 1, false), relaxedCookInterval+2)
	eq(t, p.count(perch.Out), 1, "perch from level 1")

	p, sturgeon := e.cookFish(5, sturgeon(t).Level-1, 1)
	e.do(p, cookMsg(sturgeon.ID, 1, false), relaxedCookInterval+2)
	eq(t, p.count(sturgeon.Out), 0)
	p.C.XP["cooking"] = XPForLevel(sturgeon.Level)
	e.do(p, cookMsg(sturgeon.ID, 1, false), relaxedCookInterval+2)
	eq(t, p.count(sturgeon.Out), 1)
}

func sturgeon(t *testing.T) *content.Recipe {
	t.Helper()
	return content.RecipeByID[cookedFish(5)]
}

func TestEatingCookedFishHeals(t *testing.T) {
	e := setup(t)
	p, perch := e.cookFish(1, 1, 0)
	p.give(perch.Out, 1)
	p.C.HP = 1
	e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_EatSlot{EatSlot: uint32(slotOf(p, perch.Out))}}, 1)
	eq(t, p.C.HP, 1+content.Items[perch.Out].Heal)
	eq(t, p.count(perch.Out), 0)
}

func TestFishBurnsLessOftenAsTheLevelRises(t *testing.T) {
	for _, tier := range []int{1, 5} {
		r := content.RecipeByID[cookedFish(tier)]
		e := setup(t)
		e.w.rnd = func() float64 { return burnAtFirst / 2 }
		p, _ := e.cookFish(tier, r.Level, 2)
		e.do(p, cookMsg(r.ID, 2, false), 3*relaxedCookInterval)
		eq(t, p.count(content.Cooking.Burnt), 2, "burns at the recipe's level", r.ID)

		p, _ = e.cookFish(tier, r.Level+(r.Safe-r.Level)/2+1, 2)
		e.do(p, cookMsg(r.ID, 2, false), 3*relaxedCookInterval)
		eq(t, p.count(r.Out), 2, "not halfway to the safe level", r.ID)

		e.w.rnd = func() float64 { return 0 }
		p, _ = e.cookFish(tier, r.Safe, 2)
		e.do(p, cookMsg(r.ID, 2, false), 3*relaxedCookInterval)
		eq(t, p.count(r.Out), 2, "never at the safe level", r.ID)
		check(t, r.Safe <= MaxLevel, "which can be reached", r.ID)
	}
}

func TestFishTakenOffInTimeNeverBurns(t *testing.T) {
	e := setup(t)
	e.w.rnd = func() float64 { return 0 }
	r := sturgeon(t)
	p, _ := e.cookFish(5, r.Level, 2)
	e.do(p, cookMsg(r.ID, 999, true), 1)
	check(t, r.Ready > content.RecipeByID["cooked_meat"].Ready, "a sturgeon takes longer than meat")
	ready, _ := p.onFire()
	e.run(ready - e.w.Tick)
	xp := p.C.XP["cooking"]
	e.do(p, takeOffMsg, 1)
	eq(t, p.count(r.Out), 1)
	eq(t, p.C.XP["cooking"]-xp, round(r.XP*cookBonus))
	e.run(r.Ready + cookWindow + 1)
	eq(t, p.count(content.Cooking.Burnt), 1, "left on too long")
}
