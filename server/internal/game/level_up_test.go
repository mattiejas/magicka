package game

import (
	"testing"

	"driftwake/content"
	"driftwake/server/internal/pb"
)

// levelLines are the lines that announced a level to a player.
func levelLines(c *client) []string {
	var lines []string
	for _, m := range c.msgs {
		if info := m.GetInfo(); info != nil && info.Kind == pb.InfoKind_INFO_KIND_LEVEL {
			lines = append(lines, info.Text)
		}
	}
	return lines
}

// levelUps are the level-ups a player was shown.
func levelUps(c *client) []*pb.LevelUp {
	var ups []*pb.LevelUp
	for _, m := range c.msgs {
		for _, ev := range m.GetSnapshot().GetEvents() {
			if up := ev.GetLevelUp(); up != nil {
				ups = append(ups, up)
			}
		}
	}
	return ups
}

func TestALevelSaysWhatItOpens(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.XP["mining"] = XPForLevel(9)
	e.w.addXP(p, "mining", float64(XPForLevel(10)-XPForLevel(9)))
	eq(t, levelLines(e.c[1]), []string{"Mining is now level 10. You can mine iron rock and use iron pickaxe."})
}

func TestALevelThatOpensNothingSaysOnlyTheLevel(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	e.w.addXP(p, "mining", float64(XPForLevel(2)))
	eq(t, levelLines(e.c[1]), []string{"Mining is now level 2."})
}

func TestALevelLineNamesAFewThingsAndPointsToTheSkillsTab(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.C.XP["mining"] = XPForLevel(14)
	e.w.addXP(p, "mining", float64(XPForLevel(15)-XPForLevel(14)))
	eq(t, levelLines(e.c[1]), []string{"Mining is now level 15. You can mine big copper rock, mine big iron rock " +
		"and mine big essence rock. The skills tab shows 1 more."})
}

func TestSeveralLevelsAtOnceAreOneLevelUp(t *testing.T) {
	e := setup(t)
	p := e.player(1)
	p.give(lamp, 1)
	e.do(p, &pb.ClientMessage{Msg: &pb.ClientMessage_UseLamp{UseLamp: "cooking"}}, 1)
	now := p.level("cooking")
	check(t, now > 2, "a lamp at level 1 gives several levels, got", now)
	ups := levelUps(e.c[1])
	eq(t, len(ups), 1)
	eq(t, ups[0].Level, uint32(now))
	eq(t, len(levelLines(e.c[1])), 1)
}

func TestPlayersNearbySeeALevelUp(t *testing.T) {
	e := setup(t)
	p, near, far := e.player(1), e.player(2), e.player(3)
	m := content.MapByID[p.C.Map]
	e.at(near, p.C.X+1, p.C.Y, m.ID)
	e.at(far, p.C.X+viewDistance+5, p.C.Y, m.ID)
	e.run(1)
	e.w.addXP(p, "fishing", float64(XPForLevel(10)))
	e.run(1)
	eq(t, levelUps(e.c[2]), levelUps(e.c[1]))
	eq(t, levelUps(e.c[2])[0].Player, p.ID)
	eq(t, len(levelUps(e.c[3])), 0)
	eq(t, len(levelLines(e.c[2])), 0, "what it opens is only told to whoever reached it")
}
