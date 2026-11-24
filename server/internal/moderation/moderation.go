// Package moderation keeps out and quiets players who misbehave, on the word of moderators and on real time.
package moderation

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"driftwake/server/internal/store"
)

// World is what moderation needs of the game.
type World interface {
	// Kick reports whether the player was there.
	Kick(name, reason string) bool
}

type Moderation struct {
	db         *store.Store
	world      World
	now        func() time.Time
	moderators map[string]bool

	mu       sync.Mutex
	mutes    map[int64]store.Sanction // of players who have signed in since the server started
	said     []line
	reported map[string]time.Time // when each player last reported someone
}

// line is something said in chat.
type line struct{ from, text string }

const (
	linesKept    = 300
	linesQuoted  = 8
	reportPause  = 30 * time.Second
	reportsShown = 8
)

func New(db *store.Store, world World, moderators []string) *Moderation {
	m := &Moderation{
		db:         db,
		world:      world,
		now:        time.Now,
		moderators: map[string]bool{},
		mutes:      map[int64]store.Sanction{},
		reported:   map[string]time.Time{},
	}
	for _, name := range moderators {
		m.moderators[strings.ToLower(name)] = true
	}
	return m
}

func (m *Moderation) IsModerator(name string) bool { return m.moderators[strings.ToLower(name)] }

// SignIn returns why an account may not come in, or nothing. It also remembers whether the account is muted.
func (m *Moderation) SignIn(account int64) (refusal string, err error) {
	sanctions, err := m.db.Sanctions(account, m.now())
	if err != nil {
		return "", err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.mutes, account)
	for _, s := range sanctions {
		if s.Kind == store.Ban {
			return banText(s), nil
		}
		m.mutes[account] = s
	}
	return "", nil
}

func banText(s store.Sanction) string {
	return fmt.Sprintf("You are banned until %s. Reason: %s", when(s.Until), s.Reason)
}

func when(t time.Time) string { return t.UTC().Format("2 January 2006 15:04") + " UTC" }

// Say returns why someone may not speak, or nothing, and remembers what they say.
func (m *Moderation) Say(account int64, name, text string) (refusal string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if s, muted := m.mutes[account]; muted && s.Until.After(m.now()) {
		return fmt.Sprintf("You are muted until %s. Reason: %s", when(s.Until), s.Reason)
	}
	m.said = append(m.said, line{name, text})
	if len(m.said) > linesKept {
		m.said = m.said[len(m.said)-linesKept:]
	}
	return ""
}

// Report files a complaint and returns what to tell the player who made it.
func (m *Moderation) Report(reporter, target, reason string) string {
	if strings.EqualFold(reporter, target) {
		return "You cannot report yourself."
	}
	_, proper, err := m.db.AccountNamed(target)
	if err != nil {
		log.Print(err)
		return "Your report could not be saved. Try again later."
	}
	if proper == "" {
		return "There is no player called " + target + "."
	}
	if !m.mayReport(reporter) {
		return "You have just reported someone. Wait a moment."
	}
	r := store.Report{Reporter: reporter, Target: proper, Reason: reason, Quotes: m.quotes(proper), Created: m.now()}
	if err := m.db.AddReport(r); err != nil {
		log.Print(err)
		return "Your report could not be saved. Try again later."
	}
	return "Thank you. A moderator will look at your report of " + proper + "."
}

func (m *Moderation) mayReport(reporter string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.now().Sub(m.reported[reporter]) < reportPause {
		return false
	}
	m.reported[reporter] = m.now()
	return true
}

// quotes are the last things a player said.
func (m *Moderation) quotes(name string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []string
	for i := len(m.said) - 1; i >= 0 && len(out) < linesQuoted; i-- {
		if m.said[i].from == name {
			out = append([]string{m.said[i].text}, out...)
		}
	}
	return strings.Join(out, " / ")
}
