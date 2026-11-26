package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"time"

	"driftwake/server/internal/game"
)

// Retention is counted in totals only: how many came back, never who. Days are UTC days.

const day = 24 * time.Hour

// returnWindow is a span of days after a character was made, counted from 0, in which coming back is counted.
type returnWindow struct {
	total    string
	from, to int
}

var (
	backOnDay2   = returnWindow{"back-day-2", 1, 1}
	backInWeek2  = returnWindow{"back-week-2", 7, 13}
	countedBacks = []returnWindow{backOnDay2, backInWeek2}
)

// After this many days a return is read from when the character was last saved, which the server keeps anyway.
const lateReturn = 30

// quietDays without playing count as having stopped.
const quietDays = 7

const (
	sessionsTotal = "sessions"
	sessionTime   = "session-seconds"
)

func dayOf(t time.Time) int64 { return t.UTC().Unix() / int64(day/time.Second) }

func dayName(t time.Time) string { return t.UTC().Format(time.DateOnly) }

func totalOn(name string, t time.Time) string { return name + ":" + dayName(t) }

// CountReturn counts a character that comes back in a return window for the first time.
// Call it before the character joins, while its last save is still from an earlier visit.
func (s *Store) CountReturn(account int64, now time.Time) error {
	var created, saved int64
	const query = "SELECT a.created, c.saved FROM accounts a JOIN characters c ON c.account=a.id WHERE a.id=?"
	err := s.db.QueryRow(query, account).Scan(&created, &saved)
	if errors.Is(err, sql.ErrNoRows) {
		return nil // a new character has not come back
	}
	if err != nil {
		return err
	}
	if s.waiting(account) {
		saved = now.UnixMilli() // still in the world a moment ago
	}
	made := time.UnixMilli(created)
	age := dayOf(now) - dayOf(made)
	last := dayOf(time.UnixMilli(saved)) - dayOf(made)
	for _, w := range countedBacks {
		if int64(w.from) <= age && age <= int64(w.to) && last < int64(w.from) {
			s.AddTotal(totalOn(w.total, made), 1)
		}
	}
	return nil
}

// waiting reports whether a save of the account has not been written yet.
func (s *Store) waiting(account int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pending[account] != nil || s.writing[account] != nil
}

// CountSession adds one session's length to the day it started on.
func (s *Store) CountSession(start, end time.Time) {
	s.AddTotal(totalOn(sessionsTotal, start), 1)
	s.AddTotal(totalOn(sessionTime, start), int64(end.Sub(start)/time.Second))
}

// Week is what became of the characters made in seven days.
type Week struct {
	Start                time.Time
	New                  int64
	Day2, Week2, Late    int64
	Day2Done, Week2Done  bool // whether every character could have come back by now
	LateDone             bool
	Sessions, SessionSec int64 // of everyone, on these days
	Stops                Stops
}

// Stops describes the characters of a week that have not played for quietDays.
type Stops struct {
	Count    int
	Stranded map[int]int // characters by Stranded steps done; -1 is a finished boat
	Levels   []int       // total levels, lowest first
	Deaths   map[int]int // characters by deaths
}

// Week counts what became of the characters made in the seven days from start.
func (s *Store) Week(start, now time.Time) (Week, error) {
	start = time.Unix(dayOf(start)*int64(day/time.Second), 0).UTC()
	end := start.Add(7 * day)
	w := Week{Start: start}
	for d := start; d.Before(end); d = d.Add(day) {
		w.Day2 += s.Total(totalOn(backOnDay2.total, d))
		w.Week2 += s.Total(totalOn(backInWeek2.total, d))
		w.Sessions += s.Total(totalOn(sessionsTotal, d))
		w.SessionSec += s.Total(totalOn(sessionTime, d))
	}
	lastMade := end.Add(-day)
	w.Day2Done = dayOf(now) > dayOf(lastMade)+int64(backOnDay2.to)
	w.Week2Done = dayOf(now) > dayOf(lastMade)+int64(backInWeek2.to)
	w.LateDone = dayOf(now) >= dayOf(lastMade)+lateReturn
	return w, s.countCharacters(&w, end, now)
}

// countCharacters adds the characters made in the week, and those of them that stopped.
func (s *Store) countCharacters(w *Week, end, now time.Time) error {
	// An account whose character was never saved left before doing anything; it counts as made and stopped.
	const query = `SELECT a.created, COALESCE(c.saved, a.created), c.data
		FROM accounts a LEFT JOIN characters c ON c.account=a.id WHERE a.created>=? AND a.created<?`
	rows, err := s.db.Query(query, w.Start.UnixMilli(), end.UnixMilli())
	if err != nil {
		return err
	}
	defer rows.Close()
	w.Stops = Stops{Stranded: map[int]int{}, Deaths: map[int]int{}}
	for rows.Next() {
		var created, saved int64
		var data []byte
		if err := rows.Scan(&created, &saved, &data); err != nil {
			return err
		}
		w.New++
		lastPlayed := time.UnixMilli(saved)
		if dayOf(lastPlayed)-dayOf(time.UnixMilli(created)) >= lateReturn {
			w.Late++
		}
		if now.Sub(lastPlayed) >= quietDays*day {
			if err := w.Stops.add(data); err != nil {
				return err
			}
		}
	}
	slices.Sort(w.Stops.Levels)
	return rows.Err()
}

func (st *Stops) add(data []byte) error {
	c := game.NewChar()
	if data != nil {
		if err := json.Unmarshal(data, c); err != nil {
			return fmt.Errorf("reading a character for retention: %w", err)
		}
	}
	st.Count++
	steps := c.Quests["stranded"]
	if c.BoatDone {
		steps = -1
	}
	st.Stranded[steps]++
	total := 0
	for _, xp := range c.XP {
		total += game.LevelForXP(xp)
	}
	st.Levels = append(st.Levels, total)
	st.Deaths[c.Deaths]++
	return nil
}
