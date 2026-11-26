package store

import (
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"driftwake/server/internal/game"
)

var weekStart = time.Date(2026, time.November, 2, 0, 0, 0, 0, time.UTC)

func on(days int, hour int) time.Time {
	return weekStart.Add(time.Duration(days)*day + time.Duration(hour)*time.Hour)
}

type retentionEnv struct {
	t    *testing.T
	path string
	s    *Store
}

func openRetention(t *testing.T) *retentionEnv {
	e := &retentionEnv{t: t, path: filepath.Join(t.TempDir(), "test.db")}
	e.reopen()
	t.Cleanup(func() { e.s.Close() })
	return e
}

// reopen writes every waiting total.
func (e *retentionEnv) reopen() {
	if e.s != nil {
		e.s.Close()
	}
	s, err := Open(e.path)
	if err != nil {
		e.t.Fatal(err)
	}
	e.s = s
}

func (e *retentionEnv) exec(query string, args ...any) {
	e.t.Helper()
	if _, err := e.s.db.Exec(query, args...); err != nil {
		e.t.Fatal(err)
	}
}

// newcomer makes an account at made with a character last saved then.
func (e *retentionEnv) newcomer(name string, made time.Time, c *game.Char) int64 {
	e.t.Helper()
	id, err := e.s.CreateAccount(name, []byte("s"), []byte("h"))
	if err != nil {
		e.t.Fatal(err)
	}
	e.exec("UPDATE accounts SET created=? WHERE id=?", made.UnixMilli(), id)
	data, _ := json.Marshal(c)
	e.exec("INSERT INTO characters VALUES(?,?,?)", id, string(data), made.UnixMilli())
	return id
}

// visit is a character coming back at a moment, and being saved then.
func (e *retentionEnv) visit(account int64, at time.Time) {
	e.t.Helper()
	if err := e.s.CountReturn(account, at); err != nil {
		e.t.Fatal(err)
	}
	e.exec("UPDATE characters SET saved=? WHERE account=?", at.UnixMilli(), account)
}

func (e *retentionEnv) week(now time.Time) Week {
	e.t.Helper()
	e.reopen()
	w, err := e.s.Week(weekStart, now)
	if err != nil {
		e.t.Fatal(err)
	}
	return w
}

func TestReturnsCountEachCharacterOncePerWindow(t *testing.T) {
	e := openRetention(t)
	often := e.newcomer("Often", on(0, 10), game.NewChar())
	once := e.newcomer("Once", on(6, 23), game.NewChar())
	e.newcomer("Never", on(3, 12), game.NewChar())
	e.visit(often, on(0, 20)) // the same day
	e.visit(often, on(1, 1))
	e.visit(often, on(1, 22))
	e.visit(often, on(8, 9))
	e.visit(often, on(13, 9))
	e.visit(once, on(13, 0)) // its seventh day
	e.visit(often, on(40, 0))
	w := e.week(on(41, 0))
	if w.New != 3 || w.Day2 != 1 || w.Week2 != 2 || w.Late != 1 {
		t.Fatalf("%+v", w)
	}
	if !w.Day2Done || !w.Week2Done || !w.LateDone {
		t.Fatalf("all is known by now: %+v", w)
	}
}

func TestAWeekIsNotFinalUntilItsLastCharacterCouldReturn(t *testing.T) {
	e := openRetention(t)
	w := e.week(on(19, 23))
	if !w.Day2Done || w.Week2Done {
		t.Fatalf("%+v", w)
	}
	if !e.week(on(20, 0)).Week2Done {
		t.Fatal("the second week of the last day is over")
	}
}

func TestStopsDescribeOnlyThoseWhoHaveNotPlayedForAWeek(t *testing.T) {
	e := openRetention(t)
	stuck := game.NewChar()
	stuck.Quests["stranded"] = 2
	stuck.Deaths = 3
	stuck.XP["mining"] = game.XPForLevel(5)
	done := game.NewChar()
	done.BoatDone = true
	e.newcomer("Stuck", on(1, 0), stuck)
	e.newcomer("Done", on(2, 0), done)
	playing := e.newcomer("Playing", on(2, 0), game.NewChar())
	e.visit(playing, on(30, 0))
	if _, err := e.s.CreateAccount("Gone", []byte("s"), []byte("h")); err != nil {
		t.Fatal(err)
	}
	e.exec("UPDATE accounts SET created=? WHERE key='gone'", on(3, 0).UnixMilli()) // never saved
	w := e.week(on(31, 0))
	st := w.Stops
	if w.New != 4 || st.Count != 3 || st.Stranded[2] != 1 || st.Stranded[-1] != 1 || st.Stranded[0] != 1 ||
		st.Deaths[3] != 1 || st.Deaths[0] != 2 {
		t.Fatalf("%+v", st)
	}
	base := len(stuck.XP) // every skill starts at level 1
	if st.Levels[0] != base || st.Levels[2] != base+4 {
		t.Fatalf("levels %v", st.Levels)
	}
}

func TestSessionsAddUpByTheDayTheyStarted(t *testing.T) {
	e := openRetention(t)
	e.s.CountSession(on(3, 23), on(4, 1))
	e.s.CountSession(on(6, 10), on(6, 11))
	e.s.CountSession(on(7, 10), on(7, 11)) // the next week
	w := e.week(on(8, 0))
	if w.Sessions != 2 || w.SessionSec != 3*3600 {
		t.Fatalf("%+v", w)
	}
}
