package game

import (
	"math"
	"sort"

	"driftwake/server/internal/pb"
)

var ammoFor = map[string]string{ranged: "arrow", magic: "essence"}
var outOfAmmo = map[string]string{ranged: "You have no arrows for this bow.", magic: "You have no essence."}

// playerAttack strikes a monster in reach, when the player is ready for it.
func (w *World) playerAttack(p *Player, m *Monster) {
	s := p.stats()
	p.doing = s.style
	if p.nextAttack > w.Tick {
		return
	}
	if kind := ammoFor[s.style]; kind != "" {
		bonus, ok := p.useAmmo(kind, max(1, s.tier))
		if !ok {
			w.refuse(p, outOfAmmo[s.style])
			return
		}
		s.power += bonus
	}
	p.nextAttack, p.lastCombat = w.Tick+s.speed, w.Tick
	damage := w.rollPlayerDamage(p, s, m)
	hit := &pb.Hit{From: p.ID, To: m.ID, Damage: uint32(damage), Style: s.style}
	w.emitHit(m.Map, m.X, m.Y, hit)
	if m.Def.Boss != nil {
		m.active.set(p.ID, w.Tick)
	} else if m.target == 0 {
		m.target = p.ID
	}
	if damage > 0 {
		w.damageMonster(p, m, damage, s.style)
	}
}

func (w *World) rollPlayerDamage(p *Player, s stats, m *Monster) int {
	level, d := p.level(s.style), m.Def
	defence := d.Style
	if monsterIsWorldBoss(d) {
		defence = "" // every style is equally good against a world boss
	}
	chance := HitChance(level, s.acc, float64(d.Level), d.Armour, StyleModifier(s.style, defence))
	if w.rnd() >= chance {
		return 0
	}
	damage := 1 + randomInt(w.rnd, MaxHit(level, s.power))
	return min(int(math.Ceil(m.HP)), damage)
}

func (w *World) damageMonster(p *Player, m *Monster, damage int, style string) {
	amount := float64(damage)
	if m.Def.Boss != nil {
		// A share of total health at the moment of the hit, so scaling cannot distort it.
		m.damage.set(p.ID, m.damage.get(p.ID)+amount/m.MaxHP)
	} else {
		m.damage.set(p.ID, m.damage.get(p.ID)+amount)
	}
	m.HP -= amount
	xp := amount * (xpPerDamage + xpPerDamageLevel*float64(m.Def.Level))
	w.addXP(p, style, xp)
	w.addXP(p, "vitality", xp*vitalityShare)
	if m.HP <= 0.001 { // health of scaled bosses is fractional
		w.kill(m)
	}
}

// winners get loot: everyone who contributed to a boss, or whoever did most to anything else.
func (m *Monster) winners() []uint32 {
	if m.Def.Boss != nil {
		return m.contributors()
	}
	ids := append([]uint32(nil), m.damage.ids...)
	sort.SliceStable(ids, func(a, b int) bool { return m.damage.get(ids[a]) > m.damage.get(ids[b]) })
	return ids[:min(1, len(ids))]
}

func (w *World) hurt(p *Player, from uint32, damage int, style string) {
	damage = min(damage, p.C.HP)
	p.C.HP -= damage
	p.lastCombat = w.Tick
	hit := &pb.Hit{From: from, To: p.ID, Damage: uint32(damage), Style: style}
	w.emitHit(w.mapOf(p), p.C.X, p.C.Y, hit)
	if p.C.HP <= 0 {
		w.die(p)
	}
}
