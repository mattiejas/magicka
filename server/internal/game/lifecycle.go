package game

import "math"

// enter puts a monster in the world at the place where it first stood, as if it had never fought.
func (w *World) enter(m *Monster) {
	m.Dead, m.via, m.home = false, nil, m.start
	m.X, m.Y = m.home.X, m.home.Y
	m.restore()
	w.occupy(m)
}

// leave takes a monster out of the world until respawnAt, and ends every claim to its loot.
func (w *World) leave(m *Monster, respawnAt int) {
	m.Dead, m.HP, m.target, m.respawnAt = true, 0, 0, respawnAt
	m.damage.clear()
	m.active.clear()
	w.vacate(m)
}

// restore brings a monster back to full health and ends its fights, and with them the claims to its loot.
func (m *Monster) restore() {
	m.target, m.MaxHP = 0, m.Def.HP
	if m.Def.Boss != nil {
		m.MaxHP = m.Def.Boss.BaseHP
		m.boss = &bossState{st: choose}
	}
	m.HP = m.MaxHP
	m.damage.clear()
	m.active.clear()
}

// forget makes every monster stop fighting a player who died or left. What they contributed stays.
func (w *World) forget(p *Player) {
	for _, m := range w.monsters {
		if m.target == p.ID {
			m.target = 0
		}
		m.active.del(p.ID)
	}
}

func (w *World) kill(m *Monster) {
	winners := m.winners()
	w.leave(m, w.respawnTick(m))
	w.emitDeath(m.Map, m.X, m.Y, m.ID)
	if monsterIsWorldBoss(m.Def) {
		w.worldBossDied(m)
	}
	for _, id := range winners {
		w.dropLoot(m, id)
	}
}

// respawnTick is when a monster that dies now comes back by itself.
func (w *World) respawnTick(m *Monster) int {
	if comesWhenCalled(m) {
		return math.MaxInt
	}
	return w.Tick + Ticks(m.Def.Respawn)
}

// comesWhenCalled is true for monsters that only a schedule or an encounter brings into the world.
func comesWhenCalled(m *Monster) bool { return monsterIsWorldBoss(m.Def) || m.Def.Herd }
