package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// SanctionKind is what an account is kept from.
type SanctionKind string

const (
	Mute SanctionKind = "mute"
	Ban  SanctionKind = "ban"
)

// Sanction keeps an account from something until a moment.
type Sanction struct {
	Kind   SanctionKind
	Until  time.Time
	Reason string
}

// Report is one player's complaint about another, with what the other last said.
type Report struct {
	ID                               int64
	Reporter, Target, Reason, Quotes string
	Created                          time.Time
}

// AccountNamed returns the id and proper spelling of a name; the id is 0 when there is none.
func (s *Store) AccountNamed(name string) (id int64, proper string, err error) {
	err = s.db.QueryRow("SELECT id, name FROM accounts WHERE key=?", strings.ToLower(name)).Scan(&id, &proper)
	if errors.Is(err, sql.ErrNoRows) {
		err = nil
	}
	return
}

// Sanctions lists what an account is kept from now.
func (s *Store) Sanctions(account int64, now time.Time) (out []Sanction, err error) {
	const query = "SELECT kind, until, reason FROM sanctions WHERE account=? AND until>?"
	rows, err := s.db.Query(query, account, now.UnixMilli())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var c Sanction
		var until int64
		if err := rows.Scan(&c.Kind, &until, &c.Reason); err != nil {
			return nil, err
		}
		c.Until = time.UnixMilli(until)
		out = append(out, c)
	}
	return out, rows.Err()
}

// Sanction replaces any earlier sanction of the same kind, and logs who did it.
func (s *Store) Sanction(moderator string, account int64, target string, c Sanction) error {
	const upsert = `INSERT INTO sanctions VALUES(?,?,?,?)
		ON CONFLICT(account, kind) DO UPDATE SET until=excluded.until, reason=excluded.reason`
	detail := "until " + c.Until.UTC().Format(time.DateTime) + ": " + c.Reason
	return s.logged(moderator, string(c.Kind), target, detail, func(tx *sql.Tx) error {
		_, err := tx.Exec(upsert, account, c.Kind, c.Until.UnixMilli(), c.Reason)
		return err
	})
}

// Lift ends a sanction early.
func (s *Store) Lift(moderator string, account int64, target string, kind SanctionKind) error {
	return s.logged(moderator, "un"+string(kind), target, "", func(tx *sql.Tx) error {
		_, err := tx.Exec("DELETE FROM sanctions WHERE account=? AND kind=?", account, kind)
		return err
	})
}

// LogAction records something a moderator did that leaves no other trace.
func (s *Store) LogAction(moderator, action, target, detail string) error {
	return s.logged(moderator, action, target, detail, func(*sql.Tx) error { return nil })
}

// logged does something and records it, or does neither.
func (s *Store) logged(moderator, action, target, detail string, do func(*sql.Tx) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := do(tx); err != nil {
		return err
	}
	const insert = "INSERT INTO moderator_log(moderator,action,target,detail,created) VALUES(?,?,?,?,?)"
	if _, err := tx.Exec(insert, moderator, action, target, detail, time.Now().UnixMilli()); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) AddReport(r Report) error {
	const insert = "INSERT INTO reports(reporter,target,reason,quotes,created) VALUES(?,?,?,?,?)"
	_, err := s.db.Exec(insert, r.Reporter, r.Target, r.Reason, r.Quotes, r.Created.UnixMilli())
	return err
}

// OpenReports lists the oldest reports nobody has resolved.
func (s *Store) OpenReports(limit int) (out []Report, err error) {
	const query = `SELECT id, reporter, target, reason, quotes, created FROM reports
		WHERE resolved_by IS NULL ORDER BY id LIMIT ?`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r Report
		var created int64
		if err := rows.Scan(&r.ID, &r.Reporter, &r.Target, &r.Reason, &r.Quotes, &created); err != nil {
			return nil, err
		}
		r.Created = time.UnixMilli(created)
		out = append(out, r)
	}
	return out, rows.Err()
}

// ResolveReport reports whether there was such an open report.
func (s *Store) ResolveReport(moderator string, id int64) (found bool, err error) {
	err = s.logged(moderator, "resolve", "", fmt.Sprintf("report %d", id), func(tx *sql.Tx) error {
		r, err := tx.Exec("UPDATE reports SET resolved_by=? WHERE id=? AND resolved_by IS NULL", moderator, id)
		if err != nil {
			return err
		}
		n, err := r.RowsAffected()
		if found = n > 0; !found && err == nil {
			return errNotFound
		}
		return err
	})
	if errors.Is(err, errNotFound) {
		err = nil
	}
	return
}

var errNotFound = errors.New("not found")

// Log lists the latest things moderators did, newest first.
func (s *Store) Log(limit int) (out []string, err error) {
	const query = "SELECT moderator, action, target, detail FROM moderator_log ORDER BY id DESC LIMIT ?"
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var moderator, action, target, detail string
		if err := rows.Scan(&moderator, &action, &target, &detail); err != nil {
			return nil, err
		}
		out = append(out, strings.Join(strings.Fields(moderator+": "+action+" "+target+" "+detail), " "))
	}
	return out, rows.Err()
}
