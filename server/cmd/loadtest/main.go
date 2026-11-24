// Headless players for load testing: loadtest [-n players] [-s seconds]. Starts bin/server on a temporary database.
package main

import (
	"context"
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"driftwake/server/internal/pb"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"
)

func main() {
	n, secs := flag.Int("n", 100, "players"), flag.Int("s", 300, "seconds")
	flag.Parse()
	dir, err := os.MkdirTemp("", "driftwake")
	check(err)
	defer os.RemoveAll(dir)
	var logs strings.Builder
	var mu sync.Mutex
	srv := exec.Command("bin/server")
	srv.Env = append(os.Environ(), "NODE_ENV=", "PORT=3999", "DB_PATH="+filepath.Join(dir, "l.db"), "MAGICKA_DEV=1", "TICK_STATS=1")
	w := writer(func(b []byte) { mu.Lock(); logs.Write(b); mu.Unlock() })
	srv.Stdout, srv.Stderr = w, w
	check(srv.Start())
	time.Sleep(time.Second)
	var bytes, joined, dropped atomic.Int64
	ctx, stop := context.WithCancel(context.Background())
	for i := range *n {
		go func() {
			c, _, err := websocket.Dial(ctx, "ws://localhost:3999/ws", nil)
			if err != nil {
				dropped.Add(1)
				return
			}
			c.SetReadLimit(1 << 22)
			send := func(m *pb.ClientMessage) {
				b, _ := proto.Marshal(m)
				c.Write(ctx, websocket.MessageBinary, b)
			}
			send(&pb.ClientMessage{Msg: &pb.ClientMessage_Register{Register: &pb.Credentials{Name: fmt.Sprintf("bot_%d", i), Password: "load-test-bot"}}})
			go func() {
				for range time.Tick(2 * time.Second) {
					switch r := rand.Float64(); {
					case r < 0.4:
						send(&pb.ClientMessage{Msg: &pb.ClientMessage_Gather{Gather: uint32(rand.IntN(42))<<3 | 3}})
					case r < 0.8:
						send(&pb.ClientMessage{Msg: &pb.ClientMessage_Move{Move: &pb.Tile{X: uint32(10 + rand.IntN(44)), Y: uint32(10 + rand.IntN(44))}}})
					default:
						send(&pb.ClientMessage{Msg: &pb.ClientMessage_Attack{Attack: uint32(rand.IntN(15))<<3 | 2}})
					}
				}
			}()
			for {
				_, b, err := c.Read(ctx)
				if err != nil {
					if ctx.Err() == nil {
						dropped.Add(1)
					}
					return
				}
				bytes.Add(int64(len(b)))
				if len(b) > 0 && b[0] == 0x0a {
					joined.Add(1)
				}
			}
		}()
		time.Sleep(20 * time.Millisecond)
	}
	time.Sleep(5 * time.Second)
	start := bytes.Load()
	time.Sleep(time.Duration(*secs) * time.Second)
	rate := float64(bytes.Load()-start) / float64(*secs) / float64(*n) / 1024
	stop()
	srv.Process.Signal(syscall.SIGTERM)
	srv.Wait()
	last, errs := "", 0
	for _, l := range strings.Split(strings.TrimSpace(logs.String()), "\n") {
		if strings.Contains(l, "p95") {
			last = l[strings.Index(l, "tick"):]
		} else if !strings.Contains(l, "listening") {
			errs++
			fmt.Println(l)
		}
	}
	var p95 float64
	fmt.Sscanf(last, "tick p95 %fms", &p95)
	fmt.Printf("joined %d/%d, dropped %d; %s; %.1f KB/s per client; server errors %d\n", joined.Load(), *n, dropped.Load(), last, rate, errs)
	if joined.Load() != int64(*n) || dropped.Load() > 0 || p95 >= 50 || errs > 0 {
		os.Exit(1)
	}
}

type writer func([]byte)

func (w writer) Write(b []byte) (int, error) { w(b); return len(b), nil }
func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
