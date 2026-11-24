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
	trustedProxies          []string // peer IPs whose X-Forwarded-For / Forwarded we trust
	prod, dev               bool
	moderators              []string // account names
	logMessages, tickStats  bool
}

const devBossPeriod = 2 * time.Minute

func loadConfig() (config, error) {
	c := config{
		port:        env("PORT", "3000"),
		dbPath:      env("DB_PATH", "driftwake.db"),
		clientDir:   env("CLIENT_DIR", "client/dist"),
		prod:        os.Getenv("NODE_ENV") == "production",
		dev:         os.Getenv("DRIFTWAKE_DEV") == "1",
		logMessages: os.Getenv("LOG_MESSAGES") == "1",
		tickStats:   os.Getenv("TICK_STATS") != "",
	}
	if c.prod && c.dev {
		return c, errors.New("DRIFTWAKE_DEV must not be set in production.")
	}
	c.logMessages = c.logMessages && c.dev
	c.origins = list(os.Getenv("ALLOWED_ORIGINS"))
	c.moderators = list(os.Getenv("MODERATORS"))
	for _, proxy := range list(os.Getenv("TRUSTED_PROXIES")) {
		c.trustedProxies = append(c.trustedProxies, normalizeIP(proxy))
	}
	return c, nil
}

// list splits at commas. Nothing gives nil.
func list(text string) (out []string) {
	for _, part := range strings.Split(text, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return
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
