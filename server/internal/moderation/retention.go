package moderation

import (
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"
	"time"

	"driftwake/server/internal/store"
)

// finalWeeksAgo is the latest week whose second week is over for every character made in it.
const finalWeeksAgo = 3

// retention shows, in totals only, what became of the characters made in one week, Monday to Sunday UTC.
func (m *Moderation) retention(args []string) (string, error) {
	weeksAgo := finalWeeksAgo
	if len(args) > 0 {
		n, err := strconv.Atoi(args[0])
		if err != nil || n < 0 {
			return Help, nil
		}
		weeksAgo = n
	}
	now := m.now().UTC()
	w, err := m.db.Week(monday(now).AddDate(0, 0, -7*weeksAgo), now)
	if err != nil {
		return "", err
	}
	lines := []string{
		fmt.Sprintf("Week of %s. New characters: %d.", w.Start.Format("2 January 2006"), w.New),
		fmt.Sprintf("Came back on day 2: %s. In days 8 to 14: %s. After 30 days: %s.",
			share(w.Day2, w.New, w.Day2Done), share(w.Week2, w.New, w.Week2Done), share(w.Late, w.New, w.LateDone)),
		sessions(w),
		stops(w.Stops),
	}
	return strings.Join(lines, "\n"), nil
}

func monday(t time.Time) time.Time {
	start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	return start.AddDate(0, 0, -(int(start.Weekday())+6)%7)
}

func share(n, of int64, final bool) string {
	text := strconv.FormatInt(n, 10)
	if of > 0 {
		text += fmt.Sprintf(" (%d%%)", n*100/of)
	}
	if !final {
		text += " so far"
	}
	return text
}

func sessions(w store.Week) string {
	if w.Sessions == 0 {
		return "Nobody played that week."
	}
	return fmt.Sprintf("Sessions that week, by everyone: %d, %d minutes on average.",
		w.Sessions, w.SessionSec/w.Sessions/60)
}

func stops(st store.Stops) string {
	if st.Count == 0 {
		return "None of them has stopped playing for a week."
	}
	levels := st.Levels
	return fmt.Sprintf("Of the %d who have not played for a week: Stranded steps done %s. Total level %d, half between %d and %d. Deaths %s.",
		st.Count, counts(st.Stranded, map[int]string{-1: "boat"}), levels[len(levels)/2],
		levels[len(levels)/4], levels[len(levels)*3/4], counts(st.Deaths, nil))
}

// counts lists how many characters have each value, such as "0: 3, 2: 1".
func counts(by map[int]int, names map[int]string) string {
	var parts []string
	for _, value := range slices.Sorted(maps.Keys(by)) {
		name, named := names[value]
		if !named {
			name = strconv.Itoa(value)
		}
		parts = append(parts, fmt.Sprintf("%s: %d", name, by[value]))
	}
	return strings.Join(parts, ", ")
}
