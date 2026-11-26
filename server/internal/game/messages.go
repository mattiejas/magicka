package game

import (
	"strconv"
	"strings"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// Info messages without a kind are plain.
const plain = pb.InfoKind_INFO_KIND_UNSPECIFIED

func infoMsg(text string, kind pb.InfoKind) *pb.ServerMessage {
	return &pb.ServerMessage{Msg: &pb.ServerMessage_Info{Info: &pb.Info{Text: text, Kind: kind}}}
}

func (w *World) send(p *Player, m *pb.ServerMessage) {
	if p.conn != nil {
		p.conn.Send(m)
	}
}

func (w *World) broadcast(m *pb.ServerMessage) {
	for _, p := range w.order {
		w.send(p, m)
	}
}

// tell sends a plain line of text.
func (w *World) tell(p *Player, text string) { w.send(p, infoMsg(text, plain)) }

func (w *World) info(p *Player, text string, kind pb.InfoKind) { w.send(p, infoMsg(text, kind)) }

// refuse tells a player why they cannot go on, and stops them.
func (w *World) refuse(p *Player, why string) {
	w.tell(p, why)
	w.stop(p)
}

// emit shows an event to everyone near a tile.
func (w *World) emit(m *content.Map, x, y int, ev *pb.Event) {
	w.events = append(w.events, event{m, x, y, ev})
}

func (w *World) emitHit(m *content.Map, x, y int, hit *pb.Hit) {
	w.emit(m, x, y, &pb.Event{Event: &pb.Event_Hit{Hit: hit}})
}

func (w *World) emitDeath(m *content.Map, x, y int, id uint32) {
	w.emit(m, x, y, &pb.Event{Event: &pb.Event_Death{Death: id}})
}

func (w *World) emitLevelUp(p *Player, skill string, level int) {
	up := &pb.LevelUp{Player: p.ID, Skill: skill, Level: uint32(level)}
	w.emit(w.mapOf(p), p.C.X, p.C.Y, &pb.Event{Event: &pb.Event_LevelUp{LevelUp: up}})
}

// openedNamed is how many things a level line names; the skills tab lists them all.
const openedNamed = 3

// opened says what the levels after before, up to now, open, or nothing if they open nothing.
func opened(skill string, before, now int) string {
	var texts []string
	for _, u := range content.Unlocks[skill] {
		if u.Level > before && u.Level <= now {
			texts = append(texts, u.Text)
		}
	}
	if len(texts) == 0 {
		return ""
	}
	line := ""
	if more := len(texts) - openedNamed; more > 0 {
		texts, line = texts[:openedNamed], " The skills tab shows "+strconv.Itoa(more)+" more."
	}
	return " You can " + listed(texts) + "." + line
}

// listed joins words as a sentence does: "a, b and c".
func listed(words []string) string {
	if len(words) == 1 {
		return words[0]
	}
	return strings.Join(words[:len(words)-1], ", ") + " and " + words[len(words)-1]
}

// open shows the window of a station, or of the player's grave.
func (w *World) open(p *Player, window string) {
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_OpenStation{OpenStation: window}})
}

func (w *World) sendBossStatus(p *Player) {
	boss := w.worldBoss()
	if boss == nil {
		return
	}
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Boss{Boss: &pb.BossStatus{
		Alive:        !boss.Dead,
		NextTicks:    uint32(max(0, w.nextBoss-w.Tick)),
		Contribution: float32(boss.damage.get(p.ID)),
		Online:       uint32(len(w.order)),
		Next:         boss.Def.Name,
	}}})
}

// addXP trains a skill and announces new levels.
func (w *World) addXP(p *Player, skill string, amount float64) {
	before, gained := p.level(skill), round(amount)
	p.C.XP[skill] = min(xpTable[MaxLevel], p.C.XP[skill]+gained)
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Xp{Xp: &pb.Xp{Skill: skill, Amount: uint32(gained)}}})
	now := p.level(skill)
	if now == before {
		return
	}
	title := strings.ToUpper(skill[:1]) + skill[1:]
	w.info(p, title+" is now level "+strconv.Itoa(now)+"."+opened(skill, before, now), pb.InfoKind_INFO_KIND_LEVEL)
	w.emitLevelUp(p, skill, now)
	if now == MaxLevel {
		w.broadcast(infoMsg(p.Name+" has mastered "+skill+".", pb.InfoKind_INFO_KIND_LEVEL))
		w.grantCapes(p)
	}
	if skill == "vitality" {
		p.C.HP += MaxHP(now) - MaxHP(before)
	}
}
