package moderation

import (
	_ "embed"
	"regexp"
	"strings"
)

// Words refused in names, one per line. Those marked with = are refused only as a whole word, because they also
// occur inside harmless ones. Lines may end with a # comment.
//
//go:embed names.txt
var refusedWords string

var (
	anywhere  []string
	wholeWord = map[string]bool{}

	lookalikes = strings.NewReplacer("0", "o", "1", "i", "3", "e", "4", "a", "5", "s", "7", "t", "8", "b")
	separators = regexp.MustCompile(`[_0-9]+|([a-z])([A-Z])`)
)

func init() {
	for _, line := range strings.Split(refusedWords, "\n") {
		if i := strings.IndexByte(line, '#'); i >= 0 {
			line = line[:i]
		}
		for _, w := range strings.Fields(line) {
			if whole, ok := strings.CutPrefix(w, "="); ok {
				wholeWord[strings.ToLower(whole)] = true
			} else {
				anywhere = append(anywhere, strings.ToLower(w))
			}
		}
	}
}

// NameAllowed refuses offensive names, and names that pretend to speak for the game.
func NameAllowed(name string) bool {
	plain := lookalikes.Replace(name)
	for _, word := range append(wordsOf(name), wordsOf(plain)...) {
		if wholeWord[word] {
			return false
		}
	}
	joined := strings.ToLower(strings.ReplaceAll(plain, "_", ""))
	for _, spelling := range []string{joined, shorten(joined, 2), shorten(joined, 1)} {
		for _, w := range anywhere {
			if strings.Contains(spelling, w) {
				return false
			}
		}
	}
	return true
}

// wordsOf splits a name at underscores, digits and capitals.
func wordsOf(name string) []string {
	return strings.Fields(strings.ToLower(separators.ReplaceAllString(name, "$1 $2")))
}

// shorten limits how often a letter is repeated in a row, since repeating letters is a common way around a filter.
func shorten(s string, most int) string {
	var b strings.Builder
	var last rune
	run := 0
	for _, r := range s {
		if r != last {
			last, run = r, 0
		}
		if run++; run <= most {
			b.WriteRune(r)
		}
	}
	return b.String()
}
