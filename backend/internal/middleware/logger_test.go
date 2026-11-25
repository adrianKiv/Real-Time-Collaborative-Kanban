package middleware

import "testing"

func TestRedactTokenQuery(t *testing.T) {
	cases := map[string]string{
		"/ws/boards/3?token=eyJhbGciOiJIUzI1NiJ9.abc.def": "/ws/boards/3?token=***",
		"/ws/boards/3?foo=1&token=secret&bar=2":           "/ws/boards/3?foo=1&token=***&bar=2",
		"/ws/boards/3?Token=secret":                       "/ws/boards/3?Token=***",
		"/api/boards?limit=10":                            "/api/boards?limit=10",
		"/ws/boards/3":                                    "/ws/boards/3",
	}

	for in, want := range cases {
		if got := redactTokenQuery(in); got != want {
			t.Fatalf("redactTokenQuery(%q) = %q, want %q", in, got, want)
		}
	}
}
