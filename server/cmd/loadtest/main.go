// Headless players for load testing. Starts bin/server on a temporary database.
//
//	loadtest [-n players] [-s seconds]
package main

import (
	"bytes"
	"context"
	"flag"
	"fmt"
	"log"
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

const (
	port         = "3999"
	maxTickMS    = 50
	warmUp       = 5 * time.Second
	joinPause    = 20 * time.Millisecond
	botActsEvery = 2 * time.Second

	// Kinds in the low bits of entity ids, and how many of each the island has.
	monsterKind, islandMonsters = 2, 15
	nodeKind, islandNodes       = 3, 42
)

// counters are shared by all bots.
type counters struct{ bytes, joined, dropped atomic.Int64 }

func main() {
	players, seconds := flag.Int("n", 100, "players"), flag.Int("s", 300, "seconds")
	flag.Parse()
	stopServer := startServer()
	ctx, stopBots := context.WithCancel(context.Background())
	var total counters
	for i := range *players {
		go runBot(ctx, i, &total)
		time.Sleep(joinPause)
	}
	time.Sleep(warmUp)
	before := total.bytes.Load()
	time.Sleep(time.Duration(*seconds) * time.Second)
	received := float64(total.bytes.Load() - before)
	stopBots()
	stats, problems := readLog(stopServer())

	for _, line := range problems {
		fmt.Println(line)
	}
	var p95 float64
	fmt.Sscanf(stats, "tick p95 %fms", &p95)
	rate := received / float64(*seconds) / float64(*players) / 1024
	fmt.Printf("joined %d/%d, dropped %d; %s; %.1f KB/s per client; server errors %d\n",
		total.joined.Load(), *players, total.dropped.Load(), stats, rate, len(problems))
	allJoined := total.joined.Load() == int64(*players) && total.dropped.Load() == 0
	if !allJoined || p95 == 0 || p95 >= maxTickMS || len(problems) > 0 {
		os.Exit(1)
	}
}

// startServer returns a function that stops the server and gives its log.
func startServer() func() string {
	dir, err := os.MkdirTemp("", "driftwake")
	if err != nil {
		log.Fatal(err)
	}
	var output lockedBuffer
	cmd := exec.Command("bin/server")
	cmd.Env = append(os.Environ(),
		"NODE_ENV=", "PORT="+port, "DB_PATH="+filepath.Join(dir, "load.db"), "MAGICKA_DEV=1", "TICK_STATS=1")
	cmd.Stdout, cmd.Stderr = &output, &output
	if err := cmd.Start(); err != nil {
		log.Fatal(err)
	}
	time.Sleep(time.Second)
	return func() string {
		cmd.Process.Signal(syscall.SIGTERM)
		cmd.Wait()
		os.RemoveAll(dir)
		return output.String()
	}
}

type lockedBuffer struct {
	mu sync.Mutex
	bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.Buffer.Write(p)
}

// readLog finds the last tick statistics, and every line that should not be there.
func readLog(output string) (stats string, problems []string) {
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		if i := strings.Index(line, "tick p95"); i >= 0 {
			stats = line[i:]
		} else if !strings.Contains(line, "listening") {
			problems = append(problems, line)
		}
	}
	return
}

func runBot(ctx context.Context, number int, total *counters) {
	c, _, err := websocket.Dial(ctx, "ws://localhost:"+port+"/ws", nil)
	if err != nil {
		total.dropped.Add(1)
		return
	}
	c.SetReadLimit(1 << 22)
	send(ctx, c, &pb.ClientMessage{Msg: &pb.ClientMessage_Register{Register: &pb.Credentials{
		Name: fmt.Sprintf("bot_%d", number), Password: "load-test-bot",
	}}})
	go func() {
		for range time.Tick(botActsEvery) {
			send(ctx, c, randomAction())
		}
	}()
	for {
		_, b, err := c.Read(ctx)
		if err != nil {
			if ctx.Err() == nil {
				total.dropped.Add(1)
			}
			return
		}
		total.bytes.Add(int64(len(b)))
		m := &pb.ServerMessage{}
		if proto.Unmarshal(b, m) == nil && m.GetWelcome() != nil {
			total.joined.Add(1)
		}
	}
}

func send(ctx context.Context, c *websocket.Conn, m *pb.ClientMessage) {
	if b, err := proto.Marshal(m); err == nil {
		c.Write(ctx, websocket.MessageBinary, b)
	}
}

func randomAction() *pb.ClientMessage {
	id := func(kind, count int) uint32 { return uint32(rand.IntN(count)<<3 | kind) }
	tile := func() uint32 { return uint32(10 + rand.IntN(44)) }
	switch r := rand.Float64(); {
	case r < 0.4:
		return &pb.ClientMessage{Msg: &pb.ClientMessage_Gather{Gather: id(nodeKind, islandNodes)}}
	case r < 0.8:
		return &pb.ClientMessage{Msg: &pb.ClientMessage_Move{Move: &pb.Tile{X: tile(), Y: tile()}}}
	default:
		return &pb.ClientMessage{Msg: &pb.ClientMessage_Attack{Attack: id(monsterKind, islandMonsters)}}
	}
}
