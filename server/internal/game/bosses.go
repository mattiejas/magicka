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

// Attacks with rules of their own.
const (
	attackMelee   = "melee"
	attackBoulder = "boulder"
	attackVines   = "vines"
	attackQuake   = "quake"
)

// --- the world boss's schedule

func (w *World) spawnWorldBoss() {
	m := w.worldBoss()
	if !m.Dead {
		return
	}
	resetBoss(m)
	m.Dead = false
	w.occupy(m)
	w.broadcast(infoMsg(m.Def.Name+" rises in the Rooted arena on the mainland.", pb.InfoKind_INFO_KIND_BOSS))
}

func (w *World) worldBossDied(m *Monster) {
	w.nextBoss = max(w.nextBoss, w.Tick+1)
	m.respawnAt = math.MaxInt
	w.broadcast(infoMsg(m.Def.Name+" has fallen.", pb.InfoKind_INFO_KIND_BOSS))
}

func resetBoss(m *Monster) {
	m.MaxHP = m.Def.Boss.BaseHP
	m.HP = m.MaxHP
	m.damage.clear()
	m.active.clear()
	m.boss = &bossState{st: choose}
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
	case b.st == windup:
		w.bossExecute(m, players)
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
		b.tiles = w.markTiles(m, a, players)
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

func (w *World) bossExecute(m *Monster, players []*Player) {
	b := m.boss
	a := b.atk
	b.st, b.start, b.end = execute, w.Tick, w.Tick+a.Execute
	impact := &pb.Impact{Boss: m.ID, Attack: a.ID, Tiles: flat(b.tiles)}
	w.emit(m.Map, m.X, m.Y, &pb.Event{Event: &pb.Event_Impact{Impact: impact}})
	marked := map[Point]bool{}
	for _, t := range b.tiles {
		marked[t] = true
	}
	for _, p := range players {
		if a.ID == attackMelee && (p.ID != b.tgt || !inReach(p.C.X, p.C.Y, m.rect(), 1)) {
			continue
		}
		if a.ID != attackMelee && !marked[p.at()] {
			continue
		}
		m.active.set(p.ID, w.Tick)
		if a.Root > 0 {
			p.rooted, p.path = w.Tick+a.Root, nil
		}
		w.addXP(p, "defence", float64(6+m.Def.Level))
		w.hurt(p, m.ID, a.Damage[0]+randomInt(w.rnd, a.Damage[1]-a.Damage[0]+1), a.ID)
	}
}

// --- marked ground

// tileSet collects walkable tiles once each, in order.
type tileSet struct {
	m    *content.Map
	seen map[Point]bool
	list []Point
}

func (s *tileSet) add(x, y int) {
	if p := (Point{X: x, Y: y}); s.m.Walkable(x, y) && !s.seen[p] {
		s.seen[p] = true
		s.list = append(s.list, p)
	}
}

func (w *World) markTiles(m *Monster, a *content.Attack, players []*Player) []Point {
	tiles := &tileSet{m: m.Map, seen: map[Point]bool{}}
	if a.ID == attackQuake {
		w.markRings(m, tiles)
		return tiles.list
	}
	targets := w.shuffled(players)
	for _, p := range targets[:min(len(targets), max(1, a.Count))] {
		switch a.ID {
		case attackBoulder:
			markSquare(tiles, p.at())
		case attackVines:
			markCross(tiles, p.at())
		}
	}
	return tiles.list
}

// markRings marks every other pair of rings around a boss.
func (w *World) markRings(m *Monster, tiles *tileSet) {
	arena, parity := m.Def.Boss.Arena, 1
	if w.rnd() < 0.5 {
		parity = 0
	}
	for y := m.Y - arena; y < m.Y+m.Def.Size+arena; y++ {
		for x := m.X - arena; x < m.X+m.Def.Size+arena; x++ {
			distance := RectDist(x, y, m.rect())
			if distance > 0 && distance <= arena && (distance-1)/2%2 == parity {
				tiles.add(x, y)
			}
		}
	}
}

func markSquare(tiles *tileSet, centre Point) {
	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			tiles.add(centre.X+dx, centre.Y+dy)
		}
	}
}

func markCross(tiles *tileSet, centre Point) {
	for _, d := range [...]Point{{}, {X: 1}, {X: -1}, {Y: 1}, {Y: -1}} {
		tiles.add(centre.X+d.X, centre.Y+d.Y)
	}
}

func (w *World) shuffled(players []*Player) []*Player {
	out := append([]*Player(nil), players...)
	for i := len(out) - 1; i > 0; i-- {
		j := randomInt(w.rnd, i+1)
		out[i], out[j] = out[j], out[i]
	}
	return out
}

// flat lists tiles as x, y pairs.
func flat(ps []Point) []uint32 {
	out := make([]uint32, 0, len(ps)*2)
	for _, p := range ps {
		out = append(out, uint32(p.X), uint32(p.Y))
	}
	return out
}
