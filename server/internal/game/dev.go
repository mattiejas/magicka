package game

import (
	"strconv"
	"strings"

	"driftwake/content"
)

// devCommand runs a chat command such as "give copper_ore 5". Only available on development servers.
func (w *World) devCommand(p *Player, line string) {
	args := append(strings.Fields(line), "", "", "")
	command, first, second := args[0], args[1], args[2]
	switch command {
	case "give":
		if content.Items[first] != nil {
			p.give(first, devNumber(second))
		}
	case "level":
		for _, s := range content.Skills {
			if s == first || first == "all" {
				p.C.XP[s] = xpTable[max(1, min(MaxLevel, devNumber(second)))]
			}
		}
	case "tp":
		w.devTeleport(p, first, second)
	case "map":
		if content.MapByID[first] != nil {
			w.travel(p, first)
		}
	case "boss":
		w.spawnWorldBoss()
	case "heal":
		p.C.HP = MaxHP(p.level("vitality"))
	case "die": // at the next blow
		p.C.HP = 1
	}
	p.dirty = true
}

// devNumber reads a quantity, which is 1 when left out.
func devNumber(text string) int {
	n, err := strconv.Atoi(text)
	if err != nil || n == 0 {
		return 1
	}
	return max(0, min(100_000, n))
}

func (w *World) devTeleport(p *Player, xText, yText string) {
	x, errX := strconv.Atoi(xText)
	y, errY := strconv.Atoi(yText)
	if errX != nil || errY != nil || !w.mapOf(p).Walkable(x, y) {
		return
	}
	p.C.X, p.C.Y = x, y
	w.stop(p)
}
