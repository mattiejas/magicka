package main

import (
	"net/http"
	"testing"
)

func TestClientAddressIgnoresForwardsWithoutTrustedProxies(t *testing.T) {
	got := clientAddress("203.0.113.9:443", http.Header{"X-Forwarded-For": {"198.51.100.7"}}, nil)
	if got != "203.0.113.9" {
		t.Fatalf("got %q, want socket address", got)
	}
}

func TestClientAddressIgnoresForwardsFromUntrustedPeers(t *testing.T) {
	trusted := []string{"10.0.0.1"}
	got := clientAddress("203.0.113.9:1234", http.Header{
		"X-Forwarded-For": {"198.51.100.7"},
		"Forwarded":       {"for=198.51.100.7"},
	}, trusted)
	if got != "203.0.113.9" {
		t.Fatalf("got %q, want socket address", got)
	}
}

func TestClientAddressUsesXForwardedForFromTrustedPeer(t *testing.T) {
	trusted := []string{"10.0.0.1", "::1"}
	got := clientAddress("10.0.0.1:443", http.Header{"X-Forwarded-For": {"198.51.100.7"}}, trusted)
	if got != "198.51.100.7" {
		t.Fatalf("got %q, want forwarded client", got)
	}
	// Spoofed left entries: the trusted proxy appended the real client on the right.
	got = clientAddress("[::ffff:10.0.0.1]:443", http.Header{"X-Forwarded-For": {"203.0.113.1, 198.51.100.7"}}, trusted)
	if got != "198.51.100.7" {
		t.Fatalf("got %q, want rightmost client", got)
	}
}

func TestClientAddressUsesForwardedFromTrustedPeer(t *testing.T) {
	trusted := []string{"10.0.0.1", "::1"}
	got := clientAddress("[::1]:443", http.Header{"Forwarded": {"for=198.51.100.7;proto=https"}}, trusted)
	if got != "198.51.100.7" {
		t.Fatalf("got %q, want forwarded client", got)
	}
	got = clientAddress("10.0.0.1:80", http.Header{"Forwarded": {"for=203.0.113.1, for=198.51.100.7"}}, trusted)
	if got != "198.51.100.7" {
		t.Fatalf("got %q, want rightmost for=", got)
	}
}

func TestClientAddressFallsBackWhenTrustedPeerSendsNoForward(t *testing.T) {
	got := clientAddress("10.0.0.1:443", http.Header{}, []string{"10.0.0.1"})
	if got != "10.0.0.1" {
		t.Fatalf("got %q, want socket address", got)
	}
}

func TestNormalizeIPMapsIPv4(t *testing.T) {
	if got := normalizeIP("::ffff:127.0.0.1"); got != "127.0.0.1" {
		t.Fatalf("got %q", got)
	}
}
