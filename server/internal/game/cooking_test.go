package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

func cookMsg(id string, n uint32, intense bool) *pb.ClientMessage {
	return &pb.ClientMessage{Msg: &pb.ClientMessage_Craft{Craft: &pb.Craft{Recipe: id, Qty: n, Intense: intense}}}
}

var takeOffMsg = &pb.ClientMessage{Msg: &pb.ClientMessage_TakeOff{TakeOff: &pb.Empty{}}}

// cook puts a player at the camp fire with some raw meat and a cooking level.
func (e *env) cook(level, meat int) *Player {
	p := e.player(1)
	setLevel(p, 1)
	p.C.XP["cooking"] = XPForLevel(level)
	clear(p.C.Inv)
	p.give("meat", meat)
	e.atStation(p, "fire", "island")
	return p
}

func TestACookingFireStandsAtCampAndInTown(t *testing.T) {
	for _, m := range []string{"island", "mainland"} {
		check(t, content.MapByID[m].Station("fire") != nil, m)
	}
}

func TestFoodIsCookedAtTheFire(t *testing.T) {
	for _, id := range []string{"cooked_meat", "ration", "feast"} {
		r := content.RecipeByID[id]
		eq(t, []string{r.Station, r.Skill}, []string{"fire", "cooking"}, id)
		check(t, content.Items[id].Heal > 0, id)
	}
	check(t, content.Items["meat"].Heal == 0, "raw meat heals nothing")
	feast, ration := content.RecipeByID["feast"], content.RecipeByID["ration"]
	check(t, feast.Level > ration.Level && content.Items["feast"].Heal > content.Items["ration"].Heal,
		"higher dishes need a higher level and heal more")
}

func TestCookingNeedsTheLevelOfTheRecipe(t *testing.T) {
	e := setup(t)
	p := e.cook(24, 2)
	p.give("berries", 2)
	e.do(p, cookMsg("feast", 1, false), relaxedCookInterval+2)
	eq(t, p.count("feast"), 0)
	p.C.XP["cooking"] = XPForLevel(25)
	e.w.rnd = func() float64 { return 0.99 } // and does not burn it
	e.do(p, cookMsg("feast", 1, false), relaxedCookInterval+2)
	eq(t, p.count("feast"), 1)
}

func TestTheRelaxedMethodCooksAWholeStackByItselfAndSlowly(t *testing.T) {
	e := setup(t)
	p := e.cook(50, 5)
	e.do(p, cookMsg("cooked_meat", 999, false), 2*relaxedCookInterval+1)
	eq(t, p.count("cooked_meat"), 2, "slower than crafting, which makes one every craftInterval")
	e.run(3 * relaxedCookInterval)
	eq(t, p.count("cooked_meat"), 5)
	eq(t, p.count("meat"), 0)
	eq(t, p.C.XP["cooking"], XPForLevel(50))
}

func TestFoodBurnsLessOftenAsTheLevelRises(t *testing.T) {
	r := content.RecipeByID["cooked_meat"]
	eq(t, BurnChance(r.Level, r.Level, r.Safe), burnAtFirst)
	for level := r.Level; level < r.Safe; level++ {
		check(t, BurnChance(level+1, r.Level, r.Safe) < BurnChance(level, r.Level, r.Safe), level)
	}
	for _, r := range content.Recipes {
		if r.Station == "fire" {
			eq(t, BurnChance(r.Safe, r.Level, r.Safe), 0.0, r.ID, "never burns from some level above its own")
			check(t, r.Safe > r.Level, r.ID)
		}
	}
}

func TestBurntFoodGivesNoExperienceAndIsWorthNothing(t *testing.T) {
	e := setup(t)
	p := e.cook(1, 3)
	e.w.rnd = func() float64 { return 0 }
	xp := p.C.XP["cooking"]
	e.do(p, cookMsg("cooked_meat", 3, false), 4*relaxedCookInterval)
	eq(t, p.count(content.Cooking.Burnt), 3)
	eq(t, p.count("cooked_meat"), 0)
	eq(t, p.C.XP["cooking"], xp)
	burnt := content.Items[content.Cooking.Burnt]
	eq(t, []int{burnt.Value, burnt.Heal}, []int{0, 0})
}

func TestFoodAtItsSafeLevelNeverBurns(t *testing.T) {
	e := setup(t)
	r := content.RecipeByID["cooked_meat"]
	p := e.cook(r.Safe, 3)
	e.w.rnd = func() float64 { return 0 }
	e.do(p, cookMsg("cooked_meat", 3, false), 4*relaxedCookInterval)
	eq(t, p.count("cooked_meat"), 3)
}

func TestTheIntenseMethodRewardsTakingFoodOffInTime(t *testing.T) {
	e := setup(t)
	r := content.RecipeByID["cooked_meat"]
	p := e.cook(1, 3)
	e.do(p, cookMsg(r.ID, 999, true), 1)
	ready, burns := p.onFire()
	eq(t, burns-ready, cookWindow)
	e.do(p, takeOffMsg, 1)
	eq(t, p.count(r.Out), 0, "too early does nothing")
	e.run(ready - e.w.Tick)
	xp := p.C.XP["cooking"]
	e.do(p, takeOffMsg, 1)
	eq(t, p.count(r.Out), 1)
	eq(t, p.C.XP["cooking"]-xp, round(r.XP*cookBonus))
	next, _ := p.onFire()
	check(t, next > e.w.Tick, "the next goes on the fire at once")
	e.run(r.Ready + cookWindow + 1)
	eq(t, p.count(content.Cooking.Burnt), 1, "left on too long")
	eq(t, p.count(r.Out), 1)
}

func TestTheIntenseMethodCooksOneAtATime(t *testing.T) {
	e := setup(t)
	p := e.cook(1, 3)
	e.do(p, cookMsg("cooked_meat", 999, true), 2)
	ready, _ := p.onFire()
	e.run(ready - e.w.Tick)
	e.do(p, takeOffMsg, 1)
	eq(t, p.count("meat"), 2, "only the one taken off is used")
	e.atStation(p, "bank", "island")
	ready, _ = p.onFire()
	eq(t, ready, 0, "walking away takes it off")
	eq(t, p.count("meat"), 2)
}

// The step and the reward of Stranded stayed where they were, so progress saved before cooking still counts.
func TestStrandedStillAsksForARation(t *testing.T) {
	q := questByID("stranded")
	eq(t, q.Steps[5].Need.Own[0], "ration")
	eq(t, q.Reward[1], content.Amount{Item: "ration", Qty: 5})
}

func TestCharactersFromBeforeASkillLearnIt(t *testing.T) {
	c := NewChar()
	delete(c.XP, "cooking")
	c.XP["crafting"] = 500
	c.fill()
	eq(t, c.XP["cooking"], 0)
	eq(t, c.XP["crafting"], 500, "crafting keeps what rations and feasts earned")
}
