package main

import (
	"log"
	"slices"
	"time"
)

const (
	statsWindow   = 500 // ticks
	statsInterval = 50
)

// tickStats logs how long ticks take.
type tickStats struct {
	times []time.Duration
	count int
}

func (s *tickStats) add(took time.Duration, players int) {
	s.times = append(s.times, took)
	if len(s.times) > statsWindow {
		s.times = s.times[1:]
	}
	s.count++
	if s.count%statsInterval != 0 {
		return
	}
	sorted := slices.Sorted(slices.Values(s.times))
	p95, longest := sorted[len(sorted)*95/100], sorted[len(sorted)-1]
	log.Printf("tick p95 %.1fms max %.1fms players %d", milliseconds(p95), milliseconds(longest), players)
}

func milliseconds(d time.Duration) float64 { return float64(d.Microseconds()) / 1000 }
