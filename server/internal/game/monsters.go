package game

// monsterAI chases and attacks a target, or wanders near home.
func (w *World) monsterAI(m *Monster) {
	m.via = nil
	target := w.keepTarget(m)
	if target == nil {
		target = w.findTarget(m)
	}
	switch {
	case target == nil:
		w.idle(m)
	case !inReach(target.C.X, target.C.Y, m.rect(), m.Def.Range):
		w.stepTowards(m, target.at())
	case m.nextAttack <= w.Tick:
		m.nextAttack = w.Tick + m.Def.Speed
		w.monsterAttack(m, target)
	}
}

func (m *Monster) distanceFromHome() int { return max(abs(m.X-m.home.X), abs(m.Y-m.home.Y)) }

// keepTarget gives up a target that got away, and recovers.
func (w *World) keepTarget(m *Monster) *Player {
	t := w.players[m.target]
	if t == nil {
		return nil
	}
	if t.C.Map == m.Map.ID && m.distanceFromHome() <= leashRange && !w.safe(t) {
		return t
	}
	m.target, m.HP = 0, m.MaxHP
	m.damage.clear()
	return nil
}

// findTarget picks the first player an aggressive monster notices.
func (w *World) findTarget(m *Monster) *Player {
	if m.Def.Aggro == 0 || m.distanceFromHome() > wanderRange {
		return nil
	}
	for _, p := range w.order {
		if p.C.Map == m.Map.ID && !w.safe(p) && RectDist(p.C.X, p.C.Y, m.rect()) <= m.Def.Aggro {
			m.target = p.ID
			return p
		}
	}
	return nil
}

func (w *World) idle(m *Monster) {
	if m.distanceFromHome() > wanderRange {
		w.stepTowards(m, m.home)
		return
	}
	if w.rnd() < wanderChance {
		dx := randomInt(w.rnd, 3) - 1
		dy := randomInt(w.rnd, 3) - 1
		w.stepTowards(m, Point{X: m.X + dx, Y: m.Y + dy})
	}
}

func (w *World) monsterAttack(m *Monster, p *Player) {
	d, s := m.Def, p.stats()
	chance := HitChance(d.Level, d.Acc, float64(p.level("defence")), s.armour, StyleModifier(d.Style, s.style))
	hits := w.rnd() < chance
	w.addXP(p, "defence", defenceXP+defenceXPLevel*float64(d.Level))
	if p.act.typ == actNone && p.nextAct < w.Tick && p.trade == nil { // an idle player fights back
		p.act = action{typ: actAttack, id: m.ID}
	}
	damage := 0
	if hits {
		damage = 1 + randomInt(w.rnd, MaxHit(d.Level, d.Power))
	}
	w.hurt(p, m.ID, damage, d.Style)
}

// stepTowards moves one tile, around corners and other monsters if that is simple.
func (w *World) stepTowards(m *Monster, to Point) {
	dx, dy := sign(to.X-m.X), sign(to.Y-m.Y)
	for _, d := range [...]Point{{X: dx, Y: dy}, {X: dx}, {Y: dy}} {
		if d.X == 0 && d.Y == 0 {
			continue
		}
		x, y := m.X+d.X, m.Y+d.Y
		if !canStep(m.Map, m.X, m.Y, d.X, d.Y) || w.occupied[spot{m.Map, x, y}] != nil {
			continue
		}
		w.vacate(m)
		m.X, m.Y = x, y
		m.via = []Point{{X: x, Y: y}}
		w.occupy(m)
		return
	}
}

func abs(v int) int { return max(v, -v) }

func sign(v int) int { return max(-1, min(1, v)) }
