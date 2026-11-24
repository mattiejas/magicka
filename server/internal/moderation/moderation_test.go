package moderation

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"driftwake/server/internal/store"
)

type fakeWorld struct{ kicked []string }

func (f *fakeWorld) Kick(name, _ string) bool {
	f.kicked = append(f.kicked, name)
	return true
}

type env struct {
	*Moderation
	t     *testing.T
	world *fakeWorld
	clock time.Time
	ids   map[string]int64
}

func setup(t *testing.T) *env {
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	e := &env{t: t, world: &fakeWorld{}, clock: time.Now(), ids: map[string]int64{}}
	e.Moderation = New(db, e.world, []string{"Boss_lady", "Second"})
	e.now = func() time.Time { return e.clock }
	for _, name := range []string{"Boss_lady", "Second", "Troll", "Friend"} {
		id, err := db.CreateAccount(name, []byte("s"), []byte("h"))
		if err != nil {
			t.Fatal(err)
		}
		e.ids[name] = id
	}
	return e
}

func (e *env) command(by, text, want string) {
	e.t.Helper()
	reply, handled := e.Command(by, text)
	if !handled || !strings.Contains(reply, want) {
		e.t.Fatalf("%s: %q, %v", text, reply, handled)
	}
}

func (e *env) maySay(name string) bool { return e.Say(e.ids[name], name, "hello") == "" }

func (e *env) maySignIn(name string) bool {
	refusal, err := e.SignIn(e.ids[name])
	if err != nil {
		e.t.Fatal(err)
	}
	return refusal == ""
}

func (e *env) check(ok bool, what string) {
	e.t.Helper()
	if !ok {
		e.t.Fatal(what)
	}
}

func TestMuteEndsByItselfAndSurvivesSigningIn(t *testing.T) {
	e := setup(t)
	e.check(e.maySay("Troll"), "free at first")
	e.command("boss_lady", "/mute troll 10 shouting", "Troll is muted")
	e.check(!e.maySay("Troll") && e.maySay("Friend"), "only the troll is muted")
	e.check(e.maySignIn("Troll") && !e.maySay("Troll"), "still muted after signing in again")
	e.clock = e.clock.Add(11 * time.Minute)
	e.check(e.maySay("Troll"), "over")
	e.command("Second", "/mute Troll 10 again", "muted")
	e.command("Second", "/unmute Troll", "lifted")
	e.check(e.maySay("Troll"), "lifted")
}

func TestBanKicksAndKeepsOut(t *testing.T) {
	e := setup(t)
	e.command("Boss_lady", "/ban Troll 2 scamming people", "banned")
	e.check(len(e.world.kicked) == 1 && e.world.kicked[0] == "Troll", "kicked at once")
	e.check(!e.maySignIn("Troll") && e.maySignIn("Friend"), "only the troll is kept out")
	e.clock = e.clock.Add(49 * time.Hour)
	e.check(e.maySignIn("Troll"), "over")
	e.command("Boss_lady", "/ban Troll 0 never again", "banned")
	e.clock = e.clock.Add(10 * 365 * 24 * time.Hour)
	e.check(!e.maySignIn("Troll"), "forever")
	e.command("Boss_lady", "/unban Troll", "lifted")
	e.check(e.maySignIn("Troll"), "lifted")
}

func TestOnlyModeratorsHaveCommands(t *testing.T) {
	e := setup(t)
	_, handled := e.Command("Troll", "/ban Friend 1 fun")
	e.check(!handled && e.maySignIn("Friend"), "a player's command is not carried out")
	_, handled = e.Command("Boss_lady", "/give coin 5")
	e.check(!handled, "other commands are left alone")
	e.command("Boss_lady", "/ban Second 1 coup", "is a moderator")
	e.command("Boss_lady", "/kick Nobody_here x", "no player")
	e.command("Boss_lady", "/kick Troll", "/kick name reason")
	e.command("Boss_lady", "/mute Troll ten minutes", "/mute name")
	e.command("Boss_lady", "/mute Troll -5 x", "/mute name")
}

func TestReportsQuoteAndCanBeResolved(t *testing.T) {
	e := setup(t)
	e.Say(e.ids["Troll"], "Troll", "give me your gold")
	e.Say(e.ids["Friend"], "Friend", "no")
	e.check(strings.Contains(e.Report("Friend", "troll", "scamming"), "Thank you"), "reported")
	e.check(strings.Contains(e.Report("Friend", "Troll", "scamming"), "Wait"), "not too often")
	e.check(strings.Contains(e.Report("Friend", "friend", "scamming"), "yourself"), "not oneself")
	e.check(strings.Contains(e.Report("Troll", "Nobody_here", "scamming"), "no player"), "someone who exists")
	e.command("Boss_lady", "/reports", "Troll, by Friend")
	e.command("Boss_lady", "/reports", "give me your gold")
	e.command("Boss_lady", "/resolve 1", "resolved")
	e.command("Boss_lady", "/resolve 1", "no such")
	e.command("Boss_lady", "/reports", "no open reports")
}

func TestEveryActionIsLogged(t *testing.T) {
	e := setup(t)
	for _, c := range []string{"/mute Troll 1 a", "/unmute Troll", "/kick Troll b", "/ban Troll 1 c", "/unban Troll"} {
		e.Command("Boss_lady", c)
	}
	e.Report("Friend", "Troll", "cheating")
	e.Command("Second", "/resolve 1")
	e.command("Second", "/log", "Second: resolve report 1")
	entries, err := e.db.Log(10)
	e.check(err == nil && len(entries) == 6, strings.Join(entries, "\n"))
}

func TestNames(t *testing.T) {
	for _, name := range []string{
		"Robin", "testtest", "TestA", "Nazir", "Therapist", "Ashitaka", "Nigeria", "Cassandra", "BigStaffer",
		"Hancock", "Dickens", "Assassin", "Modest", "xX_Robin_Xx", "Scunthorpe", "Peacock7", "Systematic",
	} {
		if !NameAllowed(name) {
			t.Error(name, "should be allowed")
		}
	}
	for _, name := range []string{
		"fuck_you", "Fuuuuck", "f_u_c_k", "Sh1t", "BigDick", "n1gger", "niggggger", "Admin", "admin_Bob", "GM_Anna",
		"TheModerator", "Driftwake1", "Hitler88", "a55hole",
	} {
		if NameAllowed(name) {
			t.Error(name, "should be refused")
		}
	}
}
