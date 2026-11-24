package main

import (
	"net"
	"net/http"
	"strings"
)

// clientAddress is the peer, or the forwarded client when that peer is a trusted proxy.
// Forwarded headers from anyone else are ignored so clients cannot choose their own limit key.
func clientAddress(remoteAddr string, header http.Header, trusted []string) string {
	host := peerHost(remoteAddr)
	if len(trusted) == 0 || !trustedPeer(trusted, host) {
		return host
	}
	if fwd := forwardedClient(header); fwd != "" {
		return fwd
	}
	return host
}

func peerHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return normalizeIP(host)
}

func trustedPeer(trusted []string, host string) bool {
	host = normalizeIP(host)
	for _, proxy := range trusted {
		if host == proxy {
			return true
		}
	}
	return false
}

// normalizeIP folds IPv4-mapped IPv6 so "::ffff:10.0.0.1" matches "10.0.0.1".
func normalizeIP(ip string) string {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return ip
	}
	if v4 := parsed.To4(); v4 != nil {
		return v4.String()
	}
	return parsed.String()
}

// forwardedClient takes the rightmost address from X-Forwarded-For or Forwarded (one trusted hop).
func forwardedClient(header http.Header) string {
	if xff := header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		last := strings.TrimSpace(parts[len(parts)-1])
		if last != "" {
			return normalizeIP(last)
		}
	}
	if raw := header.Get("Forwarded"); raw != "" {
		var last string
		for _, part := range strings.Split(raw, ",") {
			for _, field := range strings.Split(part, ";") {
				field = strings.TrimSpace(field)
				if len(field) < 4 || !strings.EqualFold(field[:4], "for=") {
					continue
				}
				last = normalizeIP(stripForwardedFor(field[4:]))
			}
		}
		return last
	}
	return ""
}

// stripForwardedFor removes optional quotes, IPv6 brackets and a trailing port.
func stripForwardedFor(value string) string {
	value = strings.Trim(value, `"`)
	if strings.HasPrefix(value, "[") {
		if end := strings.IndexByte(value, ']'); end > 0 {
			return value[1:end]
		}
	}
	// IPv4 with a port: 198.51.100.7:1234
	if host, _, err := net.SplitHostPort(value); err == nil {
		return host
	}
	return value
}
