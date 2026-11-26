package game

import "driftwake/content"

// cook goes on with cooking at a fire. The relaxed method cooks a whole stack by itself, slowly, and food burns
// by chance. The intense method puts one item at a time on the fire, to be taken off when it is done.
func (w *World) cook(p *Player) {
	r := p.act.recipe
	if !w.canMake(p, r) {
		return
	}
	p.doing = working
	if p.act.intense {
		w.tendFire(p)
		return
	}
	if !w.workReady(p, relaxedCookInterval) {
		return
	}
	if w.rnd() < BurnChance(p.level(r.Skill), r.Level, r.Safe) {
		w.make(p, content.Cooking.Burnt, 0)
		return
	}
	w.make(p, r.Out, r.XP)
}

// tendFire puts food on the fire, and burns what was left on too long.
func (w *World) tendFire(p *Player) {
	switch a := &p.act; {
	case a.fireReady == 0:
		a.fireReady = w.Tick + a.recipe.Ready
	case w.Tick >= burnsAt(a.fireReady):
		w.tell(p, "You left it on too long, and it burnt.")
		w.make(p, content.Cooking.Burnt, 0)
		w.nextOnFire(p)
	}
}

func burnsAt(ready int) int { return ready + cookWindow }

// takeOff takes food off the fire. Done and not yet burnt, it never burns and gives more experience.
func (w *World) takeOff(p *Player) {
	a := &p.act
	if a.typ != actCraft || !a.intense || a.fireReady == 0 || !w.canMake(p, a.recipe) {
		return
	}
	if w.Tick < a.fireReady {
		w.tell(p, "It is not done yet.")
		return
	}
	w.make(p, a.recipe.Out, a.recipe.XP*cookBonus)
	w.nextOnFire(p)
}

// nextOnFire puts the next item on at once, if the player goes on cooking.
func (w *World) nextOnFire(p *Player) {
	if p.act.typ == actCraft {
		p.act.fireReady = w.Tick + p.act.recipe.Ready
	}
}

// onFire is when the food on the fire is done, and when it burns, or zero for none.
func (p *Player) onFire() (ready, burns int) {
	if a := p.act; a.typ == actCraft && a.intense && a.fireReady > 0 {
		return a.fireReady, burnsAt(a.fireReady)
	}
	return 0, 0
}
