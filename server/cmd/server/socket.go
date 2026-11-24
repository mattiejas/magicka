package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	"driftwake/server/internal/auth"
	"driftwake/server/internal/game"
	"driftwake/server/internal/pb"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/encoding/protojson"
)

const (
	maxMessageBytes = 4096
	// A connection that has not signed in by then is closed.
	signInTimeout = 5 * time.Minute
)

// originOK keeps other websites from connecting with a visitor's browser.
func (s *server) originOK(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if s.config.origins != nil {
		return slices.Contains(s.config.origins, origin)
	}
	if !s.config.prod {
		return true
	}
	u, err := url.Parse(origin)
	return err == nil && u.Host != "" && u.Host == r.Host
}

// handleSocket serves one browser until it disconnects.
func (s *server) handleSocket(w http.ResponseWriter, r *http.Request) {
	if !s.originOK(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}
	ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // originOK has checked
		CompressionMode:    websocket.CompressionDisabled,
	})
	if err != nil {
		return
	}
	defer ws.CloseNow()
	ws.SetReadLimit(maxMessageBytes)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c := newConn(ws, cancel, s.config.logMessages)
	go c.write(ctx)

	address := clientAddress(r.RemoteAddr, r.Header, s.config.trustedProxies)
	sess := &session{server: s, conn: c, address: address, chat: newBudget(chatBurst, chatPerSecond)}
	defer sess.end()
	timeout := time.AfterFunc(signInTimeout, func() {
		if !sess.signedIn.Load() {
			cancel()
		}
	})
	defer timeout.Stop()
	sess.read(ctx)
}

// session is one connection's conversation with the server.
type session struct {
	server   *server
	conn     *conn
	address  string
	signedIn atomic.Bool
	player   uint32
	account  auth.Session
	chat     *budget
}

func (s *session) end() {
	if s.player != 0 {
		s.server.world.Leave(s.player, s.conn)
	}
}

func (s *session) read(ctx context.Context) {
	budget := newBudget(messageBurst, messagesPerSecond)
	for {
		kind, data, err := s.conn.ws.Read(ctx)
		if err != nil {
			return
		}
		if !budget.spend() || kind != websocket.MessageBinary {
			continue
		}
		msg, ok := game.Decode(data)
		if !ok {
			continue
		}
		if done := s.receive(msg); done {
			return
		}
	}
}

// receive handles one message and reports whether the conversation is over.
func (s *session) receive(msg *pb.ClientMessage) (done bool) {
	switch m := msg.Msg.(type) {
	case *pb.ClientMessage_Register:
		s.signIn(func(a *auth.Auth) (*auth.Session, error) {
			return a.Register(m.Register.Name, m.Register.Password)
		})
	case *pb.ClientMessage_Login:
		s.signIn(func(a *auth.Auth) (*auth.Session, error) {
			return a.Login(m.Login.Name, m.Login.Password)
		})
	case *pb.ClientMessage_ResumeToken:
		s.signIn(func(a *auth.Auth) (*auth.Session, error) { return a.Resume(m.ResumeToken) })
	case *pb.ClientMessage_Logout:
		if !s.inCharge() {
			return false
		}
		if err := s.server.auth.Revoke(s.account.Token); err != nil {
			log.Print(err)
		}
		return true
	default:
		if s.server.config.logMessages {
			log.Print("<- ", protojson.Format(msg))
		}
		if s.inCharge() {
			s.forward(msg)
		}
	}
	return false
}

// forward passes a message on to the game, unless it is about moderation.
func (s *session) forward(msg *pb.ClientMessage) {
	moderation, name := s.server.moderation, s.account.Name
	switch m := msg.Msg.(type) {
	case *pb.ClientMessage_Report:
		s.tell(moderation.Report(name, m.Report.Name, reportReasons[m.Report.Reason]))
		return
	case *pb.ClientMessage_Chat:
		if reply, handled := moderation.Command(name, m.Chat); handled {
			s.tell(reply)
			return
		}
		if !s.chat.spend() {
			s.tell("You are talking too fast.")
			return
		}
		if refusal := moderation.Say(s.account.Account, name, m.Chat); refusal != "" {
			s.tell(refusal)
			return
		}
	}
	s.server.world.Enqueue(s.player, msg)
}

var reportReasons = map[pb.ReportReason]string{
	pb.ReportReason_REPORT_REASON_LANGUAGE: "offensive language",
	pb.ReportReason_REPORT_REASON_SCAM:     "scamming",
	pb.ReportReason_REPORT_REASON_CHEATING: "cheating",
	pb.ReportReason_REPORT_REASON_OTHER:    "something else",
}

// tell shows lines of text to the player.
func (s *session) tell(text string) {
	for _, line := range strings.Split(text, "\n") {
		s.conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Info{Info: &pb.Info{Text: line}}})
	}
}

// inCharge is false once the player has signed in somewhere else.
func (s *session) inCharge() bool { return s.player != 0 && s.server.world.Owns(s.player, s.conn) }

func (s *session) signIn(attempt func(*auth.Auth) (*auth.Session, error)) {
	if s.player != 0 {
		return
	}
	if !s.server.logins.allow(s.address) {
		s.conn.fail("Too many attempts. Wait a minute.")
		return
	}
	account, err := attempt(s.server.auth)
	if err != nil {
		s.conn.fail(signInError(err))
		return
	}
	refusal, err := s.server.moderation.SignIn(account.Account)
	if err != nil {
		log.Print(err)
		s.conn.fail("Something went wrong.")
		return
	}
	if refusal != "" {
		s.conn.fail(refusal)
		return
	}
	welcome := &pb.Welcome{Token: account.Token, Id: game.PlayerID(account.Account)}
	s.conn.Send(&pb.ServerMessage{Msg: &pb.ServerMessage_Welcome{Welcome: welcome}})
	load := func() (*game.Char, error) { return s.server.store.Load(account.Account) }
	player, err := s.server.world.Join(account.Account, account.Name, load, s.conn)
	if err != nil {
		log.Print(err)
		s.conn.fail("Your character could not be loaded.")
		return
	}
	s.player, s.account = player, *account
	s.signedIn.Store(true)
}

// signInError is what the player is told. Anything unexpected is logged instead.
func signInError(err error) string {
	for _, expected := range []error{auth.ErrTaken, auth.ErrName, auth.ErrWrong, auth.ErrExpired} {
		if errors.Is(err, expected) {
			return expected.Error()
		}
	}
	log.Print(err)
	return "Something went wrong."
}
