package auth

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"driftwake/server/internal/game"
	"driftwake/server/internal/store"
)

func TestAccounts(t *testing.T) {
	path := filepath.Join(t.TempDir(), "t.db")
	db, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	a := New(db)
	s, err := a.Register("Tester", "a-long-phrase")
	if err != nil {
		t.Fatal(err)
	}
	want := func(err, target error) {
		t.Helper()
		if !errors.Is(err, target) || err.Error() != target.Error() {
			t.Fatalf("got %v, want %v", err, target)
		}
	}
	_, err = a.Register("tester", "another-phrase")
	want(err, ErrTaken)
	_, err = a.Login("Tester", "wrong-phrase")
	want(err, ErrWrong)
	_, err = a.Login("nobody", "wrong-phrase")
	want(err, ErrWrong)
	if r, err := a.Resume(s.Token); err != nil || r.Account != s.Account {
		t.Fatal(r, err)
	}
	if err := a.Revoke(s.Token); err != nil {
		t.Fatal(err)
	}
	_, err = a.Resume(s.Token)
	want(err, ErrExpired)
	if c, err := db.Load(s.Account); c != nil || err != nil {
		t.Fatal("a new account has no character", c, err)
	}
	c := game.NewChar()
	for i := range 50 { // a read right after a save must see it
		c.HP = i
		b, _ := json.Marshal(c)
		db.Save(map[int64][]byte{s.Account: b})
		if got, err := db.Load(s.Account); err != nil || got.HP != i {
			t.Fatal(got, err)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	if db, err = store.Open(path); err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if got, err := db.Load(s.Account); err != nil || !reflect.DeepEqual(got, c) {
		t.Fatal("not persisted", got, err)
	}
	if _, err := New(db).Login("TESTER", "a-long-phrase"); err != nil {
		t.Fatal(err)
	}
}
