package main

import (
	"net/http"
	"os"
	"path/filepath"
)

// serveFile serves the built client. Only plain files inside its folder are reachable.
func (s *server) serveFile(w http.ResponseWriter, r *http.Request) {
	path := filepath.Join(s.config.clientDir, filepath.Clean("/"+r.URL.Path))
	if r.URL.Path == "/" {
		path = filepath.Join(s.config.clientDir, "index.html")
	}
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}
