// The game server: static files, WebSocket connections and the tick loop.
package main

import (
	"log"
	"math/rand/v2"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"driftwake/server/internal/auth"
	"driftwake/server/internal/game"
	"driftwake/server/internal/store"
)

const (
	loginsPerMinute    = 12
	devLoginsPerMinute = 1000
)

type server struct {
	config config
	world  *game.World
	auth   *auth.Auth
	store  *store.Store
	logins *loginLimiter
}

func main() {
	c, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}
	db, err := store.Open(c.dbPath)
	if err != nil {
		log.Fatal(err)
	}
	s := newServer(c, db)
	listener, err := net.Listen("tcp", ":"+c.port)
	if err != nil {
		log.Fatal(err)
	}
	go func() {
		srv := &http.Server{Handler: s.routes(), ReadHeaderTimeout: 10 * time.Second}
		log.Fatal(srv.Serve(listener))
	}()
	log.Printf("listening on http://localhost:%s dev=%v", c.port, c.dev)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	s.runTicks(quit)

	s.world.SaveAll()
	if err := db.Close(); err != nil {
		log.Print(err)
	}
}

func newServer(c config, db *store.Store) *server {
	perMinute := loginsPerMinute
	if c.dev {
		perMinute = devLoginsPerMinute
	}
	return &server{
		config: c,
		world:  game.NewWorld(db, rand.Float64, c.dev, c.bossPeriod()),
		auth:   auth.New(db),
		store:  db,
		logins: newLoginLimiter(perMinute),
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.handleSocket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("/", s.serveFile)
	return mux
}

// runTicks advances the world until told to stop.
func (s *server) runTicks(quit <-chan os.Signal) {
	ticker := time.NewTicker(game.TickMS * time.Millisecond)
	defer ticker.Stop()
	var stats tickStats
	for {
		select {
		case <-ticker.C:
			started := time.Now()
			s.step()
			if s.config.tickStats {
				stats.add(time.Since(started), s.world.Online())
			}
		case <-quit:
			return
		}
	}
}

// step keeps one bad tick from taking the server down.
func (s *server) step() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("tick failed: %v\n%s", r, debug.Stack())
		}
	}()
	s.world.Step()
}
