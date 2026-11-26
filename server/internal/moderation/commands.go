package moderation

import (
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"driftwake/server/internal/store"
)

const forever = 100 * 365 * 24 * time.Hour

// Help lists what moderators can type in chat.
const Help = "/mute name minutes reason, /unmute name, /kick name reason, /ban name days reason (0 days is forever), " +
	"/unban name, /reports, /resolve number, /log, /retention weeks ago (3 by default)"

// Command carries out a moderator's chat command. handled is false for anything else.
func (m *Moderation) Command(moderator, text string) (reply string, handled bool) {
	if !m.IsModerator(moderator) || !strings.HasPrefix(text, "/") {
		return "", false
	}
	words := strings.Fields(text[1:])
	if len(words) == 0 {
		return Help, true
	}
	command, args := words[0], words[1:]
	var err error
	switch command {
	case "mod":
		reply = Help
	case "reports":
		reply, err = m.listReports()
	case "log":
		reply, err = m.listLog()
	case "retention":
		reply, err = m.retention(args)
	case "resolve":
		reply, err = m.resolve(moderator, args)
	case "mute", "ban":
		reply, err = m.sanction(moderator, store.SanctionKind(command), args)
	case "unmute", "unban":
		reply, err = m.lift(moderator, store.SanctionKind(command[2:]), args)
	case "kick":
		reply, err = m.kick(moderator, args)
	default:
		return "", false
	}
	if err != nil {
		log.Printf("/%s by %s: %v", command, moderator, err)
		reply = "That failed. See the server log."
	}
	return reply, true
}

// target is the account a command is about. problem says why it cannot go ahead.
func (m *Moderation) target(args []string) (account int64, name, problem string, err error) {
	if len(args) == 0 {
		return 0, "", Help, nil
	}
	account, name, err = m.db.AccountNamed(args[0])
	switch {
	case err != nil:
	case account == 0:
		problem = "There is no player called " + args[0] + "."
	case m.IsModerator(name):
		problem = name + " is a moderator."
	}
	return
}

// unit is what the number in a command counts.
var unit = map[store.SanctionKind]time.Duration{store.Mute: time.Minute, store.Ban: 24 * time.Hour}

func (m *Moderation) sanction(moderator string, kind store.SanctionKind, args []string) (string, error) {
	account, name, problem, err := m.target(args)
	if err != nil || problem != "" {
		return problem, err
	}
	if len(args) < 3 {
		return Help, nil
	}
	n, err := strconv.Atoi(args[1])
	if err != nil || n < 0 || time.Duration(n) > forever/unit[kind] {
		return Help, nil
	}
	length := time.Duration(n) * unit[kind]
	if n == 0 {
		length = forever
	}
	s := store.Sanction{Kind: kind, Until: m.now().Add(length), Reason: strings.Join(args[2:], " ")}
	if err := m.db.Sanction(moderator, account, name, s); err != nil {
		return "", err
	}
	if kind == store.Ban {
		m.world.Kick(name, banText(s))
		return fmt.Sprintf("%s is banned until %s.", name, when(s.Until)), nil
	}
	m.mu.Lock()
	m.mutes[account] = s
	m.mu.Unlock()
	return fmt.Sprintf("%s is muted until %s.", name, when(s.Until)), nil
}

func (m *Moderation) lift(moderator string, kind store.SanctionKind, args []string) (string, error) {
	account, name, problem, err := m.target(args)
	if err != nil || problem != "" {
		return problem, err
	}
	if err := m.db.Lift(moderator, account, name, kind); err != nil {
		return "", err
	}
	if kind == store.Mute {
		m.mu.Lock()
		delete(m.mutes, account)
		m.mu.Unlock()
	}
	return fmt.Sprintf("The %s of %s is lifted.", kind, name), nil
}

func (m *Moderation) kick(moderator string, args []string) (string, error) {
	_, name, problem, err := m.target(args)
	if err != nil || problem != "" {
		return problem, err
	}
	if len(args) < 2 {
		return Help, nil
	}
	reason := strings.Join(args[1:], " ")
	if err := m.db.LogAction(moderator, "kick", name, reason); err != nil {
		return "", err
	}
	if !m.world.Kick(name, "A moderator removed you. Reason: "+reason) {
		return name + " is not playing.", nil
	}
	return name + " was kicked.", nil
}

func (m *Moderation) listReports() (string, error) {
	reports, err := m.db.OpenReports(reportsShown)
	if err != nil || len(reports) == 0 {
		return "There are no open reports.", err
	}
	var lines []string
	for _, r := range reports {
		quotes := ""
		if r.Quotes != "" {
			quotes = " Said: " + r.Quotes
		}
		lines = append(lines, fmt.Sprintf("%d. %s, by %s on %s: %s.%s",
			r.ID, r.Target, r.Reporter, when(r.Created), r.Reason, quotes))
	}
	return strings.Join(lines, "\n"), nil
}

func (m *Moderation) listLog() (string, error) {
	entries, err := m.db.Log(reportsShown)
	if err != nil || len(entries) == 0 {
		return "Nothing has been done yet.", err
	}
	return strings.Join(entries, "\n"), nil
}

func (m *Moderation) resolve(moderator string, args []string) (string, error) {
	if len(args) == 0 {
		return Help, nil
	}
	id, err := strconv.ParseInt(args[0], 10, 64)
	if err != nil {
		return Help, nil
	}
	found, err := m.db.ResolveReport(moderator, id)
	if err != nil || !found {
		return "There is no such open report.", err
	}
	return fmt.Sprintf("Report %d is resolved.", id), nil
}
