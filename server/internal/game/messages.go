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

func (w *World) sendBossStatus(p *Player) {
	boss := w.worldBoss()
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Boss{Boss: &pb.BossStatus{
		Alive:        !boss.Dead,
		NextTicks:    uint32(max(0, w.nextBoss-w.Tick)),
		Contribution: float32(boss.damage.get(p.ID)),
		Online:       uint32(len(w.order)),
	}}})
}

// addXP trains a skill and announces new levels.
func (w *World) addXP(p *Player, skill string, amount float64) {
	before, gained := p.level(skill), round(amount)
	p.C.XP[skill] = min(xpTable[MaxLevel], p.C.XP[skill]+gained)
	p.dirty = true
	w.send(p, &pb.ServerMessage{Msg: &pb.ServerMessage_Xp{Xp: &pb.Xp{Skill: skill, Amount: uint32(gained)}}})
	now := p.level(skill)
	if now == before {
		return
	}
	title := strings.ToUpper(skill[:1]) + skill[1:]
	w.info(p, title+" is now level "+strconv.Itoa(now)+".", pb.InfoKind_INFO_KIND_LEVEL)
	if skill == "vitality" {
		p.C.HP += MaxHP(now) - MaxHP(before)
	}
}
