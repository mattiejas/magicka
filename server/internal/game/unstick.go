package game

import "driftwake/content"

// leaveBlockedGround moves a character, and their grave, to the nearest tile that can be walked to, when a map
// has changed since they were saved: a character who cannot step out of a cliff, and a grave that cannot be
// reached from outside one, would be lost.
func (c *Char) leaveBlockedGround() {
	if m := content.MapByID[c.Map]; m != nil && !m.CanReach(c.X, c.Y, 1) {
		at := m.Nearest(c.X, c.Y)
		c.X, c.Y = at.X, at.Y
	}
	if g := c.Grave; g != nil {
		if m := content.MapByID[g.Map]; m != nil && !m.CanReach(g.X, g.Y, stationReach) {
			at := m.Nearest(g.X, g.Y)
			g.X, g.Y = at.X, at.Y
		}
	}
}
