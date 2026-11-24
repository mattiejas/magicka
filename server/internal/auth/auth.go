// Package auth handles passwords and session tokens.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"time"

	"driftwake/server/internal/moderation"
	"driftwake/server/internal/store"

	"golang.org/x/crypto/scrypt"
)

// Errors meant for the player.
var (
	ErrTaken   = errors.New("That name is taken.")
	ErrWrong   = errors.New("Wrong name or password.")
	ErrExpired = errors.New("Session expired.")
	ErrName    = errors.New("That name is not allowed. Choose another one.")
)

type Auth struct {
	db   *store.Store
	slot chan struct{} // limits simultaneous password hashing, which is memory heavy
}

type Session struct {
	Account     int64
	Name, Token string
}

func New(db *store.Store) *Auth { return &Auth{db, make(chan struct{}, 4)} }

var dummySalt = make([]byte, 16)

func (a *Auth) kdf(pw string, salt []byte) ([]byte, error) {
	a.slot <- struct{}{}
	defer func() { <-a.slot }()
	return scrypt.Key([]byte(pw), salt, 16384, 8, 1, 64)
}

func sha(t string) string { h := sha256.Sum256([]byte(t)); return hex.EncodeToString(h[:]) }

func (a *Auth) issue(id int64, name string) (*Session, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	s := &Session{id, name, hex.EncodeToString(b)}
	return s, a.db.AddSession(sha(s.Token), id, time.Now().Add(14*24*time.Hour))
}

func (a *Auth) Register(name, pw string) (*Session, error) {
	if !moderation.NameAllowed(name) {
		return nil, ErrName
	}
	if old, err := a.db.FindAccount(name); err != nil || old != nil {
		return nil, errors.Join(err, taken(old))
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	hash, err := a.kdf(pw, salt)
	if err != nil {
		return nil, err
	}
	id, err := a.db.CreateAccount(name, salt, hash)
	if err != nil {
		return nil, err
	}
	if id == 0 {
		return nil, ErrTaken
	}
	return a.issue(id, name)
}

func taken(a *store.Account) error {
	if a != nil {
		return ErrTaken
	}
	return nil
}

func (a *Auth) Login(name, pw string) (*Session, error) {
	acc, err := a.db.FindAccount(name)
	if err != nil {
		return nil, err
	}
	salt := dummySalt // hash anyway, so timing does not reveal which names exist
	if acc != nil {
		salt = acc.Salt
	}
	hash, err := a.kdf(pw, salt)
	if err != nil {
		return nil, err
	}
	if acc == nil || subtle.ConstantTimeCompare(hash, acc.Hash) != 1 {
		return nil, ErrWrong
	}
	return a.issue(acc.ID, acc.Name)
}

func (a *Auth) Resume(token string) (*Session, error) {
	id, err := a.db.Session(sha(token))
	if err != nil {
		return nil, err
	}
	if id == 0 {
		return nil, ErrExpired
	}
	acc, err := a.db.Account(id)
	if err != nil {
		return nil, err
	}
	if acc == nil {
		return nil, ErrExpired
	}
	return &Session{acc.ID, acc.Name, token}, nil
}

func (a *Auth) Revoke(token string) error { return a.db.DropSession(sha(token)) }
