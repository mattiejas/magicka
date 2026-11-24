package main

import (
	"errors"
	"os"
	"strings"
	"time"

	"driftwake/server/internal/game"
)

// config comes from environment variables; see the README.
type config struct {
	port, dbPath, clientDir string
	origins                 []string // allowed in browsers; nil means this host only
	prod, dev               bool
	logMessages, tickStats  bool
}

const devBossPeriod = 2 * time.Minute

func loadConfig() (config, error) {
	c := config{
		port:        env("PORT", "3000"),
		dbPath:      env("DB_PATH", "magicka.db"),
		clientDir:   env("CLIENT_DIR", "client/dist"),
		prod:        os.Getenv("NODE_ENV") == "production",
		dev:         os.Getenv("MAGICKA_DEV") == "1",
		logMessages: os.Getenv("LOG_MESSAGES") == "1",
		tickStats:   os.Getenv("TICK_STATS") != "",
	}
	if c.prod && c.dev {
		return c, errors.New("MAGICKA_DEV must not be set in production.")
	}
	c.logMessages = c.logMessages && c.dev
	if list := os.Getenv("ALLOWED_ORIGINS"); list != "" {
		for _, origin := range strings.Split(list, ",") {
			c.origins = append(c.origins, strings.TrimSpace(origin))
		}
	}
	return c, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// bossPeriod is the number of ticks between world bosses.
func (c config) bossPeriod() int {
	if c.dev {
		return game.Ticks(devBossPeriod.Seconds())
	}
	return game.Ticks((10 * time.Minute).Seconds())
}
