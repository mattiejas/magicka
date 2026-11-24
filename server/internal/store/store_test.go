package store

import (
	"path/filepath"
	"testing"
)

func TestTotalsSurviveARestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	for _, want := range []int64{0, 7} {
		s, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := s.Total("fees"); got != want {
			t.Fatalf("got %d, want %d", got, want)
		}
		s.AddTotal("fees", 3)
		s.AddTotal("fees", 4)
		s.Close()
	}
}
