package game

import "testing"

func TestMonsterForgetsAPlayerWhoLeavesTheWorld(t *testing.T) {
	e := setup(t)
	p, q, m := e.player(1), e.player(2), e.monster("boar")
	e.strike(p, m)
	eq(t, m.target, p.ID)
	e.leaveWorld(p)
	eq(t, m.target, 0)
	e.strike(q, m)
	eq(t, m.target, q.ID, "it fights back against whoever attacks it next")
}

func TestMonsterDoesNotRememberAPlayerWhoComesBack(t *testing.T) {
	e := setup(t)
	p, m, boss := e.player(1), e.monster("boar"), e.monster("gnashclaw")
	e.strike(p, m)
	e.strike(p, boss)
	e.leaveWorld(p)
	e.player(1)
	eq(t, m.target, 0)
	check(t, !boss.active.has(p.ID), "counts as fighting")
}

func TestLeavingABossFightCostsNoContributionUnlikeDying(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	for _, m := range []*Monster{e.w.worldBoss(), e.monster("gnashclaw")} {
		p, q := e.player(1), e.player(2)
		e.fight(p, m, 0.4)
		e.fight(q, m, 0.4)
		e.leaveWorld(p)
		e.w.hurt(q, m.ID, 1e6, attackMelee)
		eq(t, m.damage.get(p.ID), 0.4, "left")
		eq(t, m.damage.get(q.ID), 0.2, "died")
		eq(t, m.active.len(), 0, "neither still fights")
	}
}

func TestContributorsWhoLeftStillGetLoot(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	for _, m := range []*Monster{e.w.worldBoss(), e.monster("gnashclaw"), e.monster("boar")} {
		p := e.player(1)
		e.fight(p, m, 0.4)
		m.HP--
		hp := m.HP
		e.leaveWorld(p)
		eq(t, m.HP, hp, "leaving heals nothing")
		e.w.drops = nil
		e.w.kill(m)
		check(t, len(e.w.drops) > 0, m.Def.ID)
		eq(t, e.w.drops[0].Owner, p.ID)
	}
}

func TestMonsterRecoversWhenItsTargetGetsAway(t *testing.T) {
	e := setup(t)
	p, m := e.player(1), e.monster("boar")
	e.strike(p, m)
	m.HP = 1
	m.damage.set(p.ID, 4)
	e.at(p, 48, 77, "mainland")
	e.run(1)
	eq(t, m.target, 0)
	eq(t, m.HP, m.Def.HP)
	eq(t, m.damage.len(), 0)
}

func TestMonsterEntersAsIfItHadNeverFought(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	for _, m := range []*Monster{e.monster("boar"), e.monster("gnashclaw"), e.w.worldBoss()} {
		fullHP := m.MaxHP
		p := e.player(1)
		e.fight(p, m, 0.4)
		if m.Def.Boss != nil {
			m.MaxHP *= 2
			m.boss = &bossState{st: windup, atk: &m.Def.Boss.Attacks[0]}
		} else {
			e.w.vacate(m)
			m.X++
			e.w.occupy(m)
			m.target = p.ID
		}
		e.w.kill(m)
		check(t, m.Dead)
		check(t, e.w.occupied[spot{m.Map, m.X, m.Y}] != m, "still in the way")
		e.w.enter(m)
		check(t, !m.Dead)
		eq(t, []float64{m.HP, m.MaxHP}, []float64{fullHP, fullHP})
		eq(t, Point{X: m.X, Y: m.Y}, m.start)
		eq(t, []int{int(m.target), m.damage.len(), m.active.len(), len(m.via)}, []int{0, 0, 0, 0})
		check(t, m.boss == nil || m.boss.st == choose && m.boss.atk == nil)
		check(t, e.w.occupied[spot{m.Map, m.X, m.Y}] == m)
	}
}

func TestMonstersAndMiniBossesComeBackAndWorldBossesWait(t *testing.T) {
	e := setup(t)
	e.w.spawnWorldBoss()
	e.w.nextBoss = 1e6
	boar, mini, world := e.monster("boar"), e.monster("gnashclaw"), e.w.worldBoss()
	for _, m := range []*Monster{boar, mini, world} {
		e.w.kill(m)
	}
	for _, m := range []*Monster{boar, mini} {
		e.run(m.respawnAt - e.w.Tick - 1)
		check(t, m.Dead, m.Def.ID)
		e.run(1)
		check(t, !m.Dead, m.Def.ID)
	}
	e.run(1000)
	check(t, world.Dead)
	e.w.spawnWorldBoss()
	check(t, !world.Dead)
}

func TestStampedeStartsAtItsBeginningAgain(t *testing.T) {
	e := setup(t)
	leader := e.monster("stampede_leader")
	check(t, leader.Dead)
	e.w.startStampede()
	e.run(20)
	check(t, leader.X > leader.start.X+10)
	e.run(stampedeTime)
	check(t, leader.Dead)
	e.w.startStampede()
	check(t, !leader.Dead)
	eq(t, []Point{{X: leader.X, Y: leader.Y}, leader.home}, []Point{leader.start, leader.start})
}

// strike lets a player hit at a monster once.
func (e *env) strike(p *Player, m *Monster) {
	setLevel(p, 1)
	p.C.HP = 1e6
	e.at(p, m.X+1, m.Y, m.Map.ID)
	p.nextAttack = 0
	e.w.playerAttack(p, m)
}

// leaveWorld disconnects a player who is out of combat, so they are gone at once.
func (e *env) leaveWorld(p *Player) {
	e.t.Helper()
	p.lastCombat = longAgo
	e.w.Leave(p.ID, e.c[p.Account])
	e.w.removeGone()
	check(e.t, e.w.players[p.ID] == nil, "still here")
}
