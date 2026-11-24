// The game server: static files, WebSocket connections and the tick loop.
package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"syscall"
	"time"

	"math/rand/v2"

	"driftwake/server/internal/auth"
	"driftwake/server/internal/game"
	"driftwake/server/internal/pb"
	"driftwake/server/internal/store"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

var (
	prod        = os.Getenv("NODE_ENV") == "production" || os.Getenv("DRIFTWAKE_ENV") == "production"
	dev         = os.Getenv("MAGICKA_DEV") == "1"
	logMessages = dev && os.Getenv("LOG_MESSAGES") == "1"
)

type server struct {
	world   *game.World
	auth    *auth.Auth
	store   *store.Store
	origins []string
	root    string
	mu      sync.Mutex
	tries   map[string]*attempts
}
type attempts struct {
	n     int
	reset time.Time
}

// authLimited allows a handful of sign-in attempts per address and minute.
func (s *server) authLimited(ip string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, t := range s.tries {
		if t.reset.Before(now) {
			delete(s.tries, k)
		}
	}
	t := s.tries[ip]
	if t == nil {
		t = &attempts{reset: now.Add(time.Minute)}
		s.tries[ip] = t
	}
	t.n++
	limit := 12
	if dev {
		limit = 1000
	}
	return t.n > limit
}

func (s *server) originOK(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if s.origins != nil {
		return slices.Contains(s.origins, o)
	}
	if !prod {
		return true
	}
	u, err := url.Parse(o)
	return err == nil && u.Host != "" && u.Host == r.Host
}

// conn queues messages so that the game never waits for a slow network.
type conn struct {
	ws     *websocket.Conn
	out    chan []byte
	cancel context.CancelFunc
	once   sync.Once
}

func (c *conn) SendRaw(b []byte) {
	select {
	case c.out <- b:
	default:
		c.cancel() // too far behind
	}
}
func (c *conn) Send(m *pb.ServerMessage) {
	b, err := proto.Marshal(m)
	if err != nil {
		log.Print(err)
		return
	}
	if logMessages {
		log.Print("-> ", protojson.Format(m))
	}
	c.SendRaw(b)
	if _, kicked := m.Msg.(*pb.ServerMessage_Kicked); kicked {
		c.once.Do(func() { time.AfterFunc(200*time.Millisecond, c.cancel) })
	}
}
func (c *conn) writer(ctx context.Context) {
	ping := time.NewTicker(30 * time.Second)
	defer ping.Stop()
	defer c.cancel()
	for {
		select {
		case b := <-c.out:
			if c.write(ctx, b) != nil {
				return
			}
		case <-ping.C:
			p, stop := context.WithTimeout(ctx, 10*time.Second)
			err := c.ws.Ping(p)
			stop()
			if err != nil {
				return
			}
		case <-ctx.Done():
			return
		}
	}
}
func (c *conn) write(ctx context.Context, b []byte) error {
	w, stop := context.WithTimeout(ctx, 10*time.Second)
	defer stop()
	return c.ws.Write(w, websocket.MessageBinary, b)
}

func (s *server) socket(w http.ResponseWriter, r *http.Request) {
	if !s.originOK(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true, CompressionMode: websocket.CompressionDisabled})
	if err != nil {
		return
	}
	defer ws.CloseNow()
	ws.SetReadLimit(4096)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := &conn{ws: ws, out: make(chan []byte, 256), cancel: cancel}
	go c.writer(ctx)
	fail := func(msg string) { c.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Error{Error: msg}}) }
	idle := time.AfterFunc(5*time.Minute, cancel)
	defer idle.Stop()
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	var id uint32
	token := ""
	defer func() {
		if id != 0 {
			s.world.Leave(id, c)
		}
	}()
	budget, last := 30.0, time.Now()
	for {
		kind, data, err := ws.Read(ctx)
		if err != nil {
			return
		}
		now := time.Now()
		budget = min(30, budget+now.Sub(last).Seconds()*15)
		last = now
		if budget < 1 {
			continue
		}
		budget--
		if kind != websocket.MessageBinary {
			continue
		}
		msg, ok := game.Decode(data)
		if !ok {
			continue
		}
		var try func() (*auth.Session, error)
		switch m := msg.Msg.(type) {
		case *pb.ClientMessage_Register:
			try = func() (*auth.Session, error) { return s.auth.Register(m.Register.Name, m.Register.Password) }
		case *pb.ClientMessage_Login:
			try = func() (*auth.Session, error) { return s.auth.Login(m.Login.Name, m.Login.Password) }
		case *pb.ClientMessage_ResumeToken:
			try = func() (*auth.Session, error) { return s.auth.Resume(m.ResumeToken) }
		case *pb.ClientMessage_Logout:
			if id != 0 && s.world.Owns(id, c) {
				if err := s.auth.Revoke(token); err != nil {
					log.Print(err)
				}
				return
			}
			continue
		default:
			if logMessages {
				log.Print("<- ", protojson.Format(msg))
			}
			if id != 0 && s.world.Owns(id, c) {
				s.world.Enqueue(id, msg)
			}
			continue
		}
		if id != 0 {
			continue
		}
		if s.authLimited(ip) {
			fail("Too many attempts. Wait a minute.")
			continue
		}
		sess, err := try()
		if err != nil {
			if errors.Is(err, auth.ErrTaken) || errors.Is(err, auth.ErrWrong) || errors.Is(err, auth.ErrExpired) {
				fail(err.Error())
			} else {
				log.Print(err)
				fail("Something went wrong.")
			}
			continue
		}
		c.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Welcome{Welcome: &pb.Welcome{Token: sess.Token, Id: game.PlayerID(sess.Account)}}})
		joined, err := s.world.Join(sess.Account, sess.Name, func() (*game.Char, error) { return s.store.Load(sess.Account) }, c)
		if err != nil {
			log.Print(err)
			fail("Your character could not be loaded.")
			continue
		}
		id, token = joined, sess.Token
		idle.Stop()
	}
}

func (s *server) files(w http.ResponseWriter, r *http.Request) {
	p := filepath.Join(s.root, filepath.Clean("/"+r.URL.Path))
	if r.URL.Path == "/" {
		p = filepath.Join(s.root, "index.html")
	}
	st, err := os.Stat(p)
	if err != nil || !st.Mode().IsRegular() || strings.Contains(r.URL.Path, "..") {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	f, err := os.Open(p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	http.ServeContent(w, r, st.Name(), st.ModTime(), f)
}

func main() {
	if prod && dev {
		log.Fatal("MAGICKA_DEV must not be set in production.")
	}
	db, err := store.Open(env("DB_PATH", "magicka.db"))
	if err != nil {
		log.Fatal(err)
	}
	period := game.Ticks(600)
	if dev {
		period = 200
	}
	s := &server{world: game.NewWorld(db, rand.Float64, dev, period), auth: auth.New(db), store: db, root: env("CLIENT_DIR", "client/dist"), tries: map[string]*attempts{}}
	if o := os.Getenv("ALLOWED_ORIGINS"); o != "" {
		for _, v := range strings.Split(o, ",") {
			s.origins = append(s.origins, strings.TrimSpace(v))
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", s.socket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("/", s.files)
	ln, err := net.Listen("tcp", ":"+env("PORT", "3000"))
	if err != nil {
		log.Fatal(err)
	}
	go func() {
		srv := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}
		log.Fatal(srv.Serve(ln))
	}()
	log.Printf("listening on http://localhost%s dev=%v", ln.Addr().String()[strings.LastIndex(ln.Addr().String(), ":"):], dev)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	tick := time.NewTicker(game.TickMS * time.Millisecond)
	var times []time.Duration
	for {
		select {
		case <-tick.C:
			t := time.Now()
			step(s.world)
			times = append(times, time.Since(t))
			if len(times) > 500 {
				times = times[1:]
			}
			if os.Getenv("TICK_STATS") != "" && s.world.Tick%50 == 0 {
				o := slices.Clone(times)
				slices.Sort(o)
				log.Printf("tick p95 %.1fms max %.1fms players %d", ms(o[len(o)*95/100]), ms(o[len(o)-1]), s.world.Online())
			}
		case <-quit:
			s.world.SaveAll()
			if err := db.Close(); err != nil {
				log.Print(err)
			}
			return
		}
	}
}
func ms(d time.Duration) float64 { return float64(d.Microseconds()) / 1000 }

// step keeps one bad tick from taking the server down.
func step(w *game.World) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("tick failed: %v", r)
		}
	}()
	w.Step()
}
