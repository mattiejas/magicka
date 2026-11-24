// Package store keeps accounts, sessions and characters in SQLite.
package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"driftwake/server/internal/game"

	_ "modernc.org/sqlite"
)

// The first migration matches databases made by the earlier TypeScript server.
var migrations = []string{
	`CREATE TABLE accounts(
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		key TEXT NOT NULL UNIQUE,
		salt BLOB NOT NULL,
		hash BLOB NOT NULL,
		created INTEGER NOT NULL
	);
	CREATE TABLE sessions(
		token_hash TEXT PRIMARY KEY,
		account INTEGER NOT NULL REFERENCES accounts(id),
		expires INTEGER NOT NULL
	);
	CREATE TABLE characters(
		account INTEGER PRIMARY KEY REFERENCES accounts(id),
		data TEXT NOT NULL,
		saved INTEGER NOT NULL
	);`,
}

const options = "?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)" +
	"&_pragma=busy_timeout(5000)&_pragma=synchronous(FULL)"

type Account struct {
	ID         int64
	Name       string
	Salt, Hash []byte
}

// Store writes characters on its own goroutine; reads see writes that are still waiting.
type Store struct {
	db      *sql.DB
	mu      sync.Mutex
	pending map[int64][]byte
	writing map[int64][]byte
	wake    chan struct{}
	stop    chan struct{}
	done    chan struct{}
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", "file:"+path+options)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	var v int
	if err := db.QueryRow("PRAGMA user_version").Scan(&v); err != nil {
		return nil, err
	}
	for i := v; i < len(migrations); i++ {
		tx, err := db.Begin()
		if err != nil {
			return nil, err
		}
		_, e1 := tx.Exec(migrations[i])
		_, e2 := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", i+1))
		if err := errors.Join(e1, e2, tx.Commit()); err != nil {
			return nil, err
		}
	}
	if _, err := db.Exec("DELETE FROM sessions WHERE expires < ?", time.Now().UnixMilli()); err != nil {
		return nil, err
	}
	s := &Store{
		db:      db,
		pending: map[int64][]byte{},
		wake:    make(chan struct{}, 1),
		stop:    make(chan struct{}),
		done:    make(chan struct{}),
	}
	go s.run()
	return s, nil
}

// FindAccount returns nil when there is none.
func (s *Store) FindAccount(name string) (*Account, error) {
	return s.account("SELECT id, name, salt, hash FROM accounts WHERE key = ?", strings.ToLower(name))
}

func (s *Store) Account(id int64) (*Account, error) {
	return s.account("SELECT id, name, salt, hash FROM accounts WHERE id = ?", id)
}

func (s *Store) account(q string, arg any) (*Account, error) {
	var a Account
	err := s.db.QueryRow(q, arg).Scan(&a.ID, &a.Name, &a.Salt, &a.Hash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &a, err
}

// CreateAccount returns 0 when the name is taken.
func (s *Store) CreateAccount(name string, salt, hash []byte) (int64, error) {
	const insert = "INSERT OR IGNORE INTO accounts(name,key,salt,hash,created) VALUES(?,?,?,?,?)"
	r, err := s.db.Exec(insert, name, strings.ToLower(name), salt, hash, time.Now().UnixMilli())
	if err != nil {
		return 0, err
	}
	if n, _ := r.RowsAffected(); n == 0 {
		return 0, nil
	}
	return r.LastInsertId()
}

func (s *Store) AddSession(tokenHash string, account int64, expires time.Time) error {
	_, err := s.db.Exec("INSERT INTO sessions VALUES(?,?,?)", tokenHash, account, expires.UnixMilli())
	return err
}

// Session returns 0 when the token is unknown or expired.
func (s *Store) Session(tokenHash string) (int64, error) {
	var id int64
	const query = "SELECT account FROM sessions WHERE token_hash=? AND expires>?"
	err := s.db.QueryRow(query, tokenHash, time.Now().UnixMilli()).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return id, err
}

func (s *Store) DropSession(tokenHash string) error {
	_, err := s.db.Exec("DELETE FROM sessions WHERE token_hash=?", tokenHash)
	return err
}

// Load returns nil for a character that was never saved.
func (s *Store) Load(account int64) (*game.Char, error) {
	s.mu.Lock()
	data := s.pending[account]
	if data == nil {
		data = s.writing[account]
	}
	s.mu.Unlock()
	if data == nil {
		err := s.db.QueryRow("SELECT data FROM characters WHERE account=?", account).Scan(&data)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
	}
	var c game.Char
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("character of account %d: %w", account, err)
	}
	return &c, nil
}

// Save keeps a character to be written soon.
func (s *Store) Save(account int64, data []byte) {
	s.mu.Lock()
	s.pending[account] = data
	s.mu.Unlock()
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// run writes what is waiting whenever something was saved.
func (s *Store) run() {
	defer close(s.done)
	for {
		select {
		case <-s.wake:
			s.flush()
		case <-s.stop:
			s.flush()
			return
		}
	}
}

func (s *Store) flush() {
	s.mu.Lock()
	s.writing, s.pending = s.pending, map[int64][]byte{}
	batch := s.writing
	s.mu.Unlock()
	if err := s.write(batch); err != nil {
		log.Printf("saving %d characters failed, will retry: %v", len(batch), err)
		s.mu.Lock()
		for k, v := range batch { // newer saves win
			if s.pending[k] == nil {
				s.pending[k] = v
			}
		}
		s.mu.Unlock()
		time.AfterFunc(time.Second, func() {
			select {
			case s.wake <- struct{}{}:
			default:
			}
		})
	}
	s.mu.Lock()
	s.writing = nil
	s.mu.Unlock()
}

const upsert = `INSERT INTO characters VALUES(?,?,?)
	ON CONFLICT(account) DO UPDATE SET data=excluded.data, saved=excluded.saved`

func (s *Store) write(batch map[int64][]byte) error {
	if len(batch) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for id, data := range batch {
		if _, err := tx.Exec(upsert, id, string(data), time.Now().UnixMilli()); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Close writes everything that is waiting.
func (s *Store) Close() error {
	close(s.stop)
	<-s.done
	return s.db.Close()
}
