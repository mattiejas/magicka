package game

import (
	"strings"

	"driftwake/server/internal/pb"
)

// Join puts a character in the world, or hands over one that is still there.
// load runs only when needed. It runs under the lock, so a leaving player's last save cannot be missed.
func (w *World) Join(account int64, name string, load func() (*Char, error), conn Conn) (uint32, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	id := PlayerID(account)
	p := w.players[id]
	fresh := false
	if p != nil {
		if p.conn != nil {
			p.conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Kicked{Kicked: "You logged in somewhere else."}})
		}
	} else {
		c, err := load()
		if err != nil {
			return 0, err
		}
		if fresh = c == nil; fresh {
			c = NewChar()
		}
		c.fill()
		p = &Player{ID: id, Account: account, Name: name, C: c, lastCombat: longAgo}
		w.players[id] = p
		w.order = append(w.order, p)
	}
	if p.trade != nil {
		w.endTrade(p.trade, "The other player left.")
	}
	p.attach(conn)
	p.lastInput = w.Tick
	w.sendSelf(p)
	if fresh {
		w.info(p, "Welcome to "+GameName+". Click a copper rock or an ash tree to begin.", plain)
	}
	w.grantCapes(p)
	w.sendBossStatus(p)
	return id, nil
}

// Leave detaches a connection, if it still owns the player.
func (w *World) Leave(id uint32, conn Conn) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if p := w.players[id]; p != nil && p.conn == conn {
		p.conn, p.leftAt = nil, w.Tick
	}
}

// Owns reports whether conn is the player's current connection.
func (w *World) Owns(id uint32, conn Conn) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	p := w.players[id]
	return p != nil && p.conn == conn
}

// Enqueue keeps a message for the next tick.
func (w *World) Enqueue(id uint32, m *pb.ClientMessage) {
	w.mu.Lock()
	w.queue = append(w.queue, intent{id, m})
	w.mu.Unlock()
}

// SaveAll saves everything that must survive, for shutting down.
func (w *World) SaveAll() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, d := range w.drops { // the ground is not saved
		if d.kept {
			w.keepForOwner(d)
		}
	}
	w.drops = nil
	for _, p := range w.order {
		w.save(p)
	}
}

// Online is the number of players in the world.
func (w *World) Online() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.order)
}

// attach makes conn the player's connection, which knows nothing of the world yet.
func (p *Player) attach(conn Conn) {
	p.conn, p.leftAt = conn, connected
	p.known, p.knownMap = map[uint32]int{}, ""
	p.told = nil
}

// logOutIdle disconnects players who have not done anything for a long time.
func (w *World) logOutIdle() {
	for _, p := range w.order {
		if p.conn == nil {
			continue
		}
		switch w.Tick - p.lastInput {
		case idleWarning:
			w.info(p, "You will be logged out in a minute unless you do something.", pb.InfoKind_INFO_KIND_BAD)
		case idleLimit:
			w.kick(p, "You were logged out after half an hour without doing anything.")
		}
	}
}

func (w *World) kick(p *Player, reason string) {
	p.conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Kicked{Kicked: reason}})
	p.conn, p.leftAt = nil, w.Tick
}

// removeGone lets disconnected players go: at once, or after a while when they were fighting.
func (w *World) removeGone() {
	stay := w.order[:0]
	for _, p := range w.order {
		if p.leftAt != connected {
			inCombat := w.Tick-p.lastCombat <= combatTime
			if !inCombat || w.Tick-p.leftAt >= lingerTime {
				w.save(p)
				delete(w.players, p.ID)
				w.forget(p)
				continue
			}
		}
		stay = append(stay, p)
	}
	clear(w.order[len(stay):])
	w.order = stay
}

// Kick disconnects a player. They may come back at once; keeping them out is up to whoever signs players in.
func (w *World) Kick(name, reason string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	p := w.playerNamed(name)
	if p == nil {
		return false
	}
	w.kick(p, reason)
	return true
}

// Tell shows a player a line of text, if they are here.
func (w *World) Tell(id uint32, text string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if p := w.players[id]; p != nil {
		w.tell(p, text)
	}
}

// playerNamed finds someone who is connected.
func (w *World) playerNamed(name string) *Player {
	for _, p := range w.order {
		if strings.EqualFold(p.Name, name) && p.conn != nil {
			return p
		}
	}
	return nil
}
