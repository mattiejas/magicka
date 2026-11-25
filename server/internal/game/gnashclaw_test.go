package game

import (
	"slices"
	"testing"

	"driftwake/server/internal/pb"
)

// bout is one player's fight against Old Gnashclaw, alone.
type bout struct {
	level  int
	metal  string // sword and full armour
	weapon string // instead of the sword, with its ammo
	ammo   string
	meals  int     // trail rations
	slips  float64 // share of the attacks that the player fails to dodge
}

type outcome struct {
	won   bool
	ticks int
	taken int
}

// safeTile is the nearest tile outside the marks and the boss that the player can walk to in a tick.
func safeTile(m *Monster, at Point) (Point, bool) {
	reached := map[Point]bool{at: true}
	frontier := []Point{at}
	for range walkSpeed {
		var next []Point
		for _, p := range frontier {
			for _, d := range dirs {
				to := Point{X: p.X + d.X, Y: p.Y + d.Y}
				if reached[to] || !canStep(m.Map, p.X, p.Y, d.X, d.Y) {
					continue
				}
				reached[to] = true
				next = append(next, to)
				if RectDist(to.X, to.Y, m.rect()) > 0 && !slices.Contains(m.boss.tiles, to) {
					return to, true
				}
			}
		}
		frontier = next
	}
	return at, false
}

// fightAlone plays a bout. The player attacks until marked, leaves the marks in the last two ticks, and comes back
// when the attack has landed. Whoever is hurt eats a ration, which delays their next blow.
func fightAlone(t *testing.T, seed uint32, f bout) outcome {
	e := setup(t)
	e.w.rnd = Mulberry(seed)
	slip := Mulberry(seed + 7777)
	p, m := e.player(1), e.monster("gnashclaw")
	setLevel(p, f.level)
	for slot, piece := range map[string]string{"weapon": "sword", "body": "plate", "legs": "greaves", "head": "helm"} {
		p.C.Equip[slot] = &Stack{f.metal + "_" + piece, 1}
	}
	if f.weapon != "" {
		equipKit(p, f.weapon, f.ammo)
	}
	p.give("ration", f.meals)
	e.at(p, m.X-1-p.stats().reach/2, m.Y+1, "island")
	full := MaxHP(f.level)
	var out outcome
	fails, decided := false, 0
	for out.ticks = 1; out.ticks < 1500; out.ticks++ {
		b := m.boss
		marked := b.st == windup && slices.Contains(b.tiles, p.at())
		if b.st == windup && b.start != decided {
			decided, fails = b.start, slip() < f.slips
		}
		if food := slotOf(p, "ration"); p.C.HP < full-14 && food >= 0 && !p.isEating(e.w.Tick) {
			e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_EatSlot{EatSlot: uint32(food)}}, 0)
		}
		switch {
		case marked && !fails && e.w.Tick >= b.end-2:
			if to, ok := safeTile(m, p.at()); ok {
				e.do(p, move(uint32(to.X), uint32(to.Y)), 0)
			}
		case p.act.typ == actNone && b.st != windup:
			e.do(p, attackMsg(m.ID), 0)
		}
		hp := p.C.HP
		e.run(1)
		out.taken += max(0, hp-p.C.HP)
		if m.Dead {
			out.won = true
			return out
		}
		if p.C.Grave != nil {
			return out
		}
	}
	return out
}

// TestGnashclawCanBeBeatenAlone measures him: `go test ./server/internal/game -run Gnashclaw -v`.
func TestGnashclawCanBeBeatenAlone(t *testing.T) {
	const fights = 40
	wins := func(f bout) (out int) {
		seconds, taken := 0.0, 0
		for seed := range uint32(fights) {
			o := fightAlone(t, seed, f)
			seconds, taken = seconds+float64(o.ticks)*TickMS/1000, taken+o.taken
			if o.won {
				out++
			}
		}
		t.Logf("%+v: won %d of %d, on average %.0f s and %d damage taken", f, out, fights, seconds/fights, taken/fights)
		return
	}
	for _, kit := range [][2]string{{}, {"oak_bow", "copper_arrow"}, {"oak_staff", "essence"}} {
		ten := bout{level: 10, metal: "iron", weapon: kit[0], ammo: kit[1], meals: 5, slips: 0.25}
		check(t, wins(ten) >= fights*8/10, "level 10 who dodges three of four")
		five := bout{level: 5, metal: "copper", weapon: kit[0], ammo: kit[1], meals: 10, slips: 0.25}
		check(t, wins(five) >= fights*8/10, "level 5 with food who dodges three of four")
		five.meals, five.slips = 0, 0
		check(t, wins(five) >= fights*9/10, "level 5 who dodges everything")
		ten.slips = 1
		check(t, wins(ten) <= fights*3/10, "standing still")
	}
	ten := bout{level: 10, metal: "iron"}
	check(t, wins(ten) >= fights*9/10, "level 10 without food who dodges everything")
}
