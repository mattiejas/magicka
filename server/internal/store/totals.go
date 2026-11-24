package store

import (
	"database/sql"
	"errors"
	"log"
)

const addTotal = `INSERT INTO totals VALUES(?,?)
	ON CONFLICT(name) DO UPDATE SET value=value+excluded.value`

// Total is the saved count, or 0 for one that was never added to.
func (s *Store) Total(name string) (value int64) {
	err := s.db.QueryRow("SELECT value FROM totals WHERE name=?", name).Scan(&value)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("total %s: %v", name, err)
	}
	return value
}

// AddTotal adds to a count, to be written soon.
func (s *Store) AddTotal(name string, n int64) {
	s.mu.Lock()
	s.totals[name] += n
	s.mu.Unlock()
	s.wakeWriter()
}
