package game

import "math"

// currentCurve numbers the experience table characters are saved with.
const currentCurve = 2

func firstCurve(n int) int { return int(math.Floor(25 * math.Pow(float64(n-1), 2.2))) }

// updateXP moves a character saved with the first experience table to the current one, keeping every level and the
// progress towards the next.
func (c *Char) updateXP() {
	if c.Curve >= currentCurve {
		return
	}
	c.Curve = currentCurve
	for skill, xp := range c.XP {
		c.XP[skill] = fromFirstCurve(xp)
	}
}

func fromFirstCurve(xp int) int {
	n := 1
	for n < MaxLevel && xp >= firstCurve(n+1) {
		n++
	}
	if n == MaxLevel {
		return xpTable[n]
	}
	progress := float64(xp-firstCurve(n)) / float64(firstCurve(n+1)-firstCurve(n))
	return xpTable[n] + int(progress*float64(xpTable[n+1]-xpTable[n]))
}
