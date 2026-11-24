package game

// Step advances the world by one tick and sends every player what changed.
func (w *World) Step() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Tick++
	w.handleQueue()
	for _, g := range w.glows {
		w.moveGlow(g)
	}
	for _, p := range w.order {
		w.actPlayer(p)
	}
	for _, m := range w.monsters {
		w.actMonster(m)
	}
	if w.Tick >= w.nextBoss {
		w.nextBoss = w.Tick + w.bossPeriod
		w.spawnWorldBoss()
	}
	w.removeExpiredDrops()
	if w.Tick%regenInterval == 0 {
		w.regenerate()
	}
	w.logOutIdle()
	w.removeGone()
	if w.Tick%saveInterval == 0 {
		for _, p := range w.order {
			w.save(p)
		}
	}
	w.sendSnapshots()
}

func (w *World) handleQueue() {
	queue := w.queue
	w.queue = nil
	for _, i := range queue {
		if p := w.players[i.id]; p != nil {
			p.lastInput = w.Tick
			w.handle(p, i.m)
		}
	}
}

func (w *World) actMonster(m *Monster) {
	switch {
	case m.Dead:
		if w.Tick >= m.respawnAt {
			w.respawn(m)
		}
	case m.Def.Boss != nil:
		w.bossAI(m)
	default:
		w.monsterAI(m)
	}
}

func (w *World) respawn(m *Monster) {
	m.Dead, m.HP, m.target, m.via = false, m.MaxHP, 0, nil
	m.X, m.Y = m.home.X, m.home.Y
	if m.Def.Boss != nil {
		resetBoss(m)
	}
	w.occupy(m)
}

func (w *World) regenerate() {
	for _, p := range w.order {
		full := MaxHP(p.level("vitality"))
		if p.C.HP < full {
			p.C.HP = min(full, p.C.HP+1+full/60)
			p.dirty = true
		}
	}
}
