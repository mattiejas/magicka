package main

import (
	"sync"
	"time"
)

// budget limits how many messages a connection may send: a burst, refilled steadily.
type budget struct {
	left float64
	last time.Time
}

const (
	messageBurst      = 30
	messagesPerSecond = 15
)

func newBudget() *budget { return &budget{messageBurst, time.Now()} }

// spend reports whether there was room for one more message.
func (b *budget) spend() bool {
	now := time.Now()
	b.left = min(messageBurst, b.left+now.Sub(b.last).Seconds()*messagesPerSecond)
	b.last = now
	if b.left < 1 {
		return false
	}
	b.left--
	return true
}

// loginLimiter counts sign-in attempts per address.
type loginLimiter struct {
	perMinute int
	mu        sync.Mutex
	attempts  map[string]*attempts
}
type attempts struct {
	count int
	reset time.Time
}

func newLoginLimiter(perMinute int) *loginLimiter {
	return &loginLimiter{perMinute: perMinute, attempts: map[string]*attempts{}}
}

// allow counts an attempt and reports whether it may go ahead.
func (l *loginLimiter) allow(address string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	for k, a := range l.attempts {
		if a.reset.Before(now) {
			delete(l.attempts, k)
		}
	}
	a := l.attempts[address]
	if a == nil {
		a = &attempts{reset: now.Add(time.Minute)}
		l.attempts[address] = a
	}
	a.count++
	return a.count <= l.perMinute
}
