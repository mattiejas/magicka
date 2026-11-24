// Package cmd holds an end-to-end check of the built server: `go test ./server/cmd` after `npm run build`.
package cmd

import (
	"context"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"driftwake/server/internal/pb"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"
)

const base = "localhost:3998"

func boot(t *testing.T, db string) func() {
	bin, _ := filepath.Abs("../../bin/server")
	if _, err := os.Stat(bin); err != nil {
		t.Skip("run npm run build first")
	}
	c := exec.Command(bin)
	c.Env = append(os.Environ(),
		"DRIFTWAKE_DEV=", "NODE_ENV=production", "PORT=3998", "DB_PATH="+db, "CLIENT_DIR=../../client/dist")
	if err := c.Start(); err != nil {
		t.Fatal(err)
	}
	for range 50 {
		if r, err := http.Get("http://" + base + "/health"); err == nil {
			r.Body.Close()
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	return func() { c.Process.Signal(syscall.SIGTERM); c.Wait() }
}

func dial(origin string) (*websocket.Conn, error) {
	options := &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {origin}}}
	c, _, err := websocket.Dial(context.Background(), "ws://"+base+"/ws", options)
	return c, err
}

func say(c *websocket.Conn, m *pb.ClientMessage) {
	b, _ := proto.Marshal(m)
	c.Write(context.Background(), websocket.MessageBinary, b)
}

// watch reads for a while and returns the token and the own character's last position.
func watch(c *websocket.Conn, d time.Duration) (token string, x, y uint32, kicked bool) {
	ctx, stop := context.WithTimeout(context.Background(), d)
	defer stop()
	var me uint32
	for {
		_, b, err := c.Read(ctx)
		if err != nil {
			return
		}
		m := &pb.ServerMessage{}
		proto.Unmarshal(b, m)
		if w := m.GetWelcome(); w != nil {
			token, me = w.Token, w.Id
		}
		kicked = kicked || m.GetKicked() != ""
		for _, e := range m.GetSnapshot().GetEntities() {
			if e.Id == me {
				if e.X != nil {
					x = *e.X
				}
				if e.Y != nil {
					y = *e.Y
				}
			}
		}
	}
}

func TestProductionServer(t *testing.T) {
	db := filepath.Join(t.TempDir(), "s.db")
	stop := boot(t, db)
	pages := map[string]int{"/": 200, "/..%2f..%2fpackage.json": 404, "/../../go.mod": 404, "/nope": 404}
	for path, want := range pages {
		r, err := http.Get("http://" + base + path)
		if err != nil {
			t.Fatal(err)
		}
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
		if r.StatusCode != want {
			t.Errorf("%s: %d", path, r.StatusCode)
		}
	}
	if _, err := dial("http://elsewhere.test"); err == nil {
		t.Error("foreign origin was accepted")
	}
	c, err := dial("http://" + base)
	if err != nil {
		t.Fatal(err)
	}
	credentials := &pb.Credentials{Name: "Smoke", Password: "smoke-test-pw"}
	say(c, &pb.ClientMessage{Msg: &pb.ClientMessage_Register{Register: credentials}})
	time.AfterFunc(time.Second, func() {
		say(c, &pb.ClientMessage{Msg: &pb.ClientMessage_Move{Move: &pb.Tile{X: 26, Y: 40}}})
	})
	c.Write(context.Background(), websocket.MessageBinary, []byte{0xff, 0xff}) // nonsense is ignored
	time.AfterFunc(5*time.Second, func() {
		d, _ := dial("http://" + base)
		again := &pb.Credentials{Name: "smoke", Password: credentials.Password}
		say(d, &pb.ClientMessage{Msg: &pb.ClientMessage_Login{Login: again}})
		watch(d, 2*time.Second)
	})
	token, x, y, kicked := watch(c, 8*time.Second)
	if x != 26 || y != 40 || !kicked {
		t.Fatal("before restart", x, y, "kicked", kicked)
	}
	stop()
	defer boot(t, db)()
	c, err = dial("http://" + base)
	if err != nil {
		t.Fatal(err)
	}
	say(c, &pb.ClientMessage{Msg: &pb.ClientMessage_ResumeToken{ResumeToken: token}})
	if _, x, y, _ := watch(c, 2*time.Second); x != 26 || y != 40 {
		t.Fatal("after restart", x, y)
	}
}
