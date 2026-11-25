package game

import (
	"math"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

const (
	choose  = pb.BossState_BOSS_STATE_CHOOSE
	windup  = pb.BossState_BOSS_STATE_WINDUP
	execute = pb.BossState_BOSS_STATE_EXECUTE
)

// attackMelee has a target instead of marked ground, and so no shape.
const attackMelee = "melee"

// --- the world boss's schedule

func (w *World) spawnWorldBoss() {
	m := w.worldBoss()
	if m == nil || !m.Dead {
		return
	}
	w.enter(m)
	w.broadcast(infoMsg(m.Def.Name+" rises in the "+arenaName(m)+" on the "+m.Map.ID+".", pb.InfoKind_INFO_KIND_BOSS))
}

func (w *World) worldBossDied(m *Monster) {
	w.nextBoss = max(w.nextBoss, w.Tick+1)
	w.broadcast(infoMsg(m.Def.Name+" has fallen.", pb.InfoKind_INFO_KIND_BOSS))
	w.scheduleNextWorldBoss(m)
}

// arenaName is the map label nearest the boss's home tile.
func arenaName(m *Monster) string {
	best, bestDist := "", math.MaxFloat64
	for _, l := range m.Map.Labels {
		d := math.Hypot(float64(l.X-m.start.X), float64(l.Y-m.start.Y))
		if d < bestDist {
			bestDist, best = d, l.Name
		}
	}
	return best
}

// --- who takes part

// contributors have done enough to earn loot.
func (m *Monster) contributors() (out []uint32) {
	for _, id := range m.damage.ids {
		if m.damage.get(id) > lootShare {
			out = append(out, id)
		}
	}
	return
}

// challengers are the players in a boss's arena.
func (w *World) challengers(m *Monster) (out []*Player) {
	for _, p := range w.order {
		if p.C.Map == m.Map.ID && !w.safe(p) && RectDist(p.C.X, p.C.Y, m.rect()) <= m.Def.Boss.Arena {
			out = append(out, p)
		}
	}
	return
}

// rescale fits a boss's health to the players who are really fighting it, keeping its percentage.
// Whoever has not contributed enough for loot does not count, so joining never hurts the others.
func (w *World) rescale(m *Monster) {
	fighters := 0
	for _, id := range append([]uint32(nil), m.active.ids...) {
		p := w.players[id]
		if p == nil || p.C.Map != m.Map.ID || w.Tick-m.active.get(id) > fightMemory {
			m.active.del(id)
		} else if m.damage.get(id) > lootShare {
			fighters++
		}
	}
	if hp := BossMaxHP(m.Def.Boss.BaseHP, fighters); hp != m.MaxHP {
		m.HP, m.MaxHP = m.HP/m.MaxHP*hp, hp
	}
}

// heal restores some health every tick, in a fight or not. Healing undoes everyone's damage in proportion.
func (m *Monster) heal() {
	missing := m.MaxHP - m.HP
	amount := min(missing, m.MaxHP*m.Def.Boss.Regen*TickMS/1000)
	if amount <= 0 {
		return
	}
	m.HP += amount
	if amount == missing {
		m.HP = m.MaxHP
		m.damage.clear()
		return
	}
	left := 1 - amount/missing
	for _, id := range m.damage.ids {
		m.damage.set(id, m.damage.get(id)*left)
	}
}

// --- the attack loop

// bossAI loops choose, windup, execute. Everything about an attack is fixed when it is chosen.
func (w *World) bossAI(m *Monster) {
	players := w.challengers(m)
	w.rescale(m)
	m.heal()
	b := m.boss
	switch {
	case b.st == choose:
		w.bossChoose(m, players)
	case w.Tick < b.end:
		w.bossStrikes(m)
	case b.st == windup:
		w.bossExecute(m)
	default:
		m.boss = &bossState{st: choose, start: b.start, end: b.end}
	}
}

func (w *World) bossChoose(m *Monster, players []*Player) {
	var close []*Player // in reach of melee
	noticed := m.active.len() > 0
	for _, p := range players {
		distance := RectDist(p.C.X, p.C.Y, m.rect())
		noticed = noticed || distance <= approachRange
		if distance <= 1 {
			close = append(close, p)
		}
	}
	if len(players) == 0 || !noticed {
		return
	}
	a := w.pickAttack(m, len(close) > 0)
	b := &bossState{st: windup, atk: a, start: w.Tick, end: w.Tick + a.Windup}
	if a.ID == attackMelee {
		b.tgt = close[randomInt(w.rnd, len(close))].ID
	} else {
		b.plan(shapes[a.Shape](w, m, a, players), b.end)
	}
	m.boss = b
}

// pickAttack draws by weight. Melee needs someone in reach.
func (w *World) pickAttack(m *Monster, inMelee bool) *content.Attack {
	var options []*content.Attack
	total := 0.0
	for i := range m.Def.Boss.Attacks {
		a := &m.Def.Boss.Attacks[i]
		if a.ID != attackMelee || inMelee {
			options = append(options, a)
			total += a.Weight
		}
	}
	draw := w.rnd() * total
	for _, a := range options {
		if draw -= a.Weight; draw < 0 {
			return a
		}
	}
	return options[0]
}

func (w *World) bossExecute(m *Monster) {
	b := m.boss
	a := b.atk
	b.st, b.start, b.end = execute, w.Tick, w.Tick+a.Execute
	if a.ID == attackMelee {
		w.emit(m.Map, m.X, m.Y, &pb.Event{Event: &pb.Event_Impact{Impact: &pb.Impact{Boss: m.ID, Attack: a.ID}}})
		w.bossMelee(m)
		return
	}
	w.bossStrikes(m)
}

// bossMelee hits the player it targeted, if still in reach.
func (w *World) bossMelee(m *Monster) {
	b := m.boss
	for _, p := range w.challengers(m) {
		if p.ID == b.tgt && inReach(p.C.X, p.C.Y, m.rect(), 1) {
			w.bossHit(m, p)
		}
	}
}

// bossStrikes lands the strikes of this tick, in order.
func (w *World) bossStrikes(m *Monster) {
	for _, s := range m.boss.strikes {
		if s.at != w.Tick {
			continue
		}
		impact := &pb.Impact{Boss: m.ID, Attack: m.boss.atk.ID, Tiles: flat(s.tiles), Centres: flat(s.centres)}
		w.emit(m.Map, m.X, m.Y, &pb.Event{Event: &pb.Event_Impact{Impact: impact}})
		marked := map[Point]bool{}
		for _, t := range s.tiles {
			marked[t] = true
		}
		// Looked up again for each strike: a player who died to an earlier one is in town now,
		// where the same coordinates may be marked on another map.
		for _, p := range w.challengers(m) {
			if marked[p.at()] {
				w.bossHit(m, p)
			}
		}
	}
}

func (w *World) bossHit(m *Monster, p *Player) {
	a := m.boss.atk
	m.active.set(p.ID, w.Tick)
	if a.Root > 0 {
		p.rooted, p.path = w.Tick+a.Root, nil
	}
	w.addXP(p, "defence", float64(6+m.Def.Level))
	w.hurt(p, m.ID, a.Damage[0]+randomInt(w.rnd, a.Damage[1]-a.Damage[0]+1), a.ID)
}

// flat lists tiles as x, y pairs.
func flat(ps []Point) []uint32 {
	out := make([]uint32, 0, len(ps)*2)
	for _, p := range ps {
		out = append(out, uint32(p.X), uint32(p.Y))
	}
	return out
}
