package main

import (
	"context"
	"log"
	"sync"
	"time"

	"driftwake/server/internal/pb"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

const (
	sendQueue    = 256 // messages a slow client may fall behind
	writeTimeout = 10 * time.Second
	pingInterval = 30 * time.Second
	kickDelay    = 200 * time.Millisecond // lets the reason arrive
)

// conn queues messages, so that the game never waits for a slow network.
type conn struct {
	ws          *websocket.Conn
	out         chan []byte
	cancel      context.CancelFunc
	kick        sync.Once
	logMessages bool
}

func newConn(ws *websocket.Conn, cancel context.CancelFunc, logMessages bool) *conn {
	return &conn{ws: ws, out: make(chan []byte, sendQueue), cancel: cancel, logMessages: logMessages}
}

// SendRaw queues an encoded message. A client that has fallen too far behind is dropped.
func (c *conn) SendRaw(b []byte) {
	select {
	case c.out <- b:
	default:
		c.cancel()
	}
}

// Send queues a message. Kicking also closes the connection.
func (c *conn) Send(m *pb.ServerMessage) {
	b, err := proto.Marshal(m)
	if err != nil {
		log.Print(err)
		return
	}
	if c.logMessages {
		log.Print("-> ", protojson.Format(m))
	}
	c.SendRaw(b)
	if _, kicked := m.Msg.(*pb.ServerMessage_Kicked); kicked {
		c.kick.Do(func() { time.AfterFunc(kickDelay, c.cancel) })
	}
}

func (c *conn) fail(text string) {
	c.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Error{Error: text}})
}

// write sends queued messages until the connection ends.
func (c *conn) write(ctx context.Context) {
	defer c.cancel()
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()
	for {
		var err error
		select {
		case b := <-c.out:
			err = withTimeout(ctx, func(ctx context.Context) error {
				return c.ws.Write(ctx, websocket.MessageBinary, b)
			})
		case <-ping.C:
			err = withTimeout(ctx, c.ws.Ping)
		case <-ctx.Done():
			return
		}
		if err != nil {
			return
		}
	}
}

func withTimeout(ctx context.Context, f func(context.Context) error) error {
	ctx, stop := context.WithTimeout(ctx, writeTimeout)
	defer stop()
	return f(ctx)
}
