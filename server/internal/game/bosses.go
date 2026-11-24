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

// share lists the players whose contribution earns loot.
func (m *Monster) share() (out []uint32) {
	for _, id := range m.dmg.ids {
		if m.dmg.get(id) > 0.02 {
			out = append(out, id)
		}
	}
	return
}

func (w *World) near(m *Monster) (out []*Player) {
	for _, p := range w.order {
		if p.C.Map == m.Map.ID && !w.safe(p) && RectDist(p.C.X, p.C.Y, m.rect()) <= m.Def.Boss.Arena {
			out = append(out, p)
		}
	}
	return
}

func (w *World) rescale(m *Monster) {
	for _, id := range append([]uint32(nil), m.active.ids...) {
		if p := w.players[id]; w.Tick-m.active.get(id) > Ticks(20) || p == nil || p.C.Map != m.Map.ID {
			m.active.del(id)
		}
	}
	if m.active.len() == 0 {
		return
	}
	if hp := BossMaxHP(m.Def.Boss.BaseHP, m.active.len()); hp != m.MaxHP {
		m.HP, m.MaxHP = m.HP/m.MaxHP*hp, hp
	}
}

func (w *World) tilesFor(m *Monster, a *content.Attack, ps []*Player) (out []Point) {
	seen := map[Point]bool{}
	put := func(x, y int) {
		if q := (Point{X: x, Y: y}); m.Map.Walkable(x, y) && !seen[q] {
			seen[q] = true
			out = append(out, q)
		}
	}
	if a.ID == "quake" {
		ar, parity := m.Def.Boss.Arena, 1
		if w.rnd() < 0.5 {
			parity = 0
		}
		for y := m.Y - ar; y < m.Y+m.Def.Size+ar; y++ {
			for x := m.X - ar; x < m.X+m.Def.Size+ar; x++ {
				if d := RectDist(x, y, m.rect()); d > 0 && d <= ar && (d-1)>>1%2 == parity {
					put(x, y)
				}
			}
		}
		return
	}
	pool := append([]*Player(nil), ps...)
	for i := len(pool) - 1; i > 0; i-- {
		j := int(math.Floor(w.rnd() * float64(i+1)))
		pool[i], pool[j] = pool[j], pool[i]
	}
	for _, p := range pool[:min(len(pool), max(1, a.Count))] {
		r := 0
		if a.ID == "boulder" {
			r = 1
		}
		for j := -r; j <= r; j++ {
			for i := -r; i <= r; i++ {
				put(p.C.X+i, p.C.Y+j)
			}
		}
		if a.ID == "vines" {
			for _, d := range [4]Point{{X: 1}, {X: -1}, {Y: 1}, {Y: -1}} {
				put(p.C.X+d.X, p.C.Y+d.Y)
			}
		}
	}
	return
}

// bossAI loops choose, windup, execute. Everything about the attack is fixed at choose.
func (w *World) bossAI(m *Monster) {
	b, ps := m.boss, w.near(m)
	w.rescale(m)
	if b.st == choose {
		if len(ps) == 0 {
			if m.dmg.len() > 0 && m.active.len() == 0 {
				m.dmg.clear()
				m.MaxHP = m.Def.Boss.BaseHP
				m.HP = m.MaxHP
			}
			return
		}
		var close []*Player
		approached := false
		for _, p := range ps {
			d := RectDist(p.C.X, p.C.Y, m.rect())
			approached = approached || d <= 4
			if d <= 1 {
				close = append(close, p)
			}
		}
		// Only fight once provoked, or when someone steps close.
		if m.active.len() == 0 && !approached {
			return
		}
		var opts []*content.Attack
		total := 0.0
		for i := range m.Def.Boss.Attacks {
			if a := &m.Def.Boss.Attacks[i]; a.ID != "melee" || len(close) > 0 {
				opts = append(opts, a)
				total += a.Weight
			}
		}
		r, a := w.rnd()*total, opts[0]
		for _, o := range opts {
			if r -= o.Weight; r < 0 {
				a = o
				break
			}
		}
		b.atk, b.st, b.start, b.end, b.tgt, b.tiles = a, windup, w.Tick, w.Tick+a.Windup, 0, nil
		if a.ID == "melee" {
			b.tgt = close[int(math.Floor(w.rnd()*float64(len(close))))].ID
		} else {
			b.tiles = w.tilesFor(m, a, ps)
		}
		return
	}
	if w.Tick < b.end {
		return
	}
	if b.st == execute {
		b.st, b.atk, b.tiles, b.tgt = choose, nil, nil, 0
		return
	}
	a := b.atk
	b.st, b.start, b.end = execute, w.Tick, w.Tick+a.Execute
	marked := map[Point]bool{}
	for _, t := range b.tiles {
		marked[t] = true
	}
	w.emit(m.Map, m.X, m.Y, &pb.Event{Event: &pb.Event_Impact{Impact: &pb.Impact{Boss: m.ID, Attack: a.ID, Tiles: flat(b.tiles)}}})
	for _, p := range ps {
		if a.ID == "melee" {
			if p.ID != b.tgt || !inReach(p.C.X, p.C.Y, m.rect(), 1) {
				continue
			}
		} else if !marked[Point{X: p.C.X, Y: p.C.Y}] {
			continue
		}
		m.active.set(p.ID, w.Tick)
		if a.Root > 0 {
			p.rooted, p.path = w.Tick+a.Root, nil
		}
		w.addXP(p, "defence", float64(6+m.Def.Level))
		w.hurt(p, m.ID, a.Damage[0]+int(math.Floor(w.rnd()*float64(a.Damage[1]-a.Damage[0]+1))), a.ID)
	}
}

func resetBoss(m *Monster) {
	m.MaxHP = m.Def.Boss.BaseHP
	m.HP = m.MaxHP
	m.dmg.clear()
	m.active.clear()
	m.boss = &bossState{st: choose}
}
func flat(ps []Point) []uint32 {
	out := make([]uint32, 0, len(ps)*2)
	for _, p := range ps {
		out = append(out, uint32(p.X), uint32(p.Y))
	}
	return out
}
