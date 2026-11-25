package middleware

import (
	"fmt"
	"regexp"

	"github.com/gin-gonic/gin"
)

// tokenQueryPattern matches "token=..." inside a request URI so websocket
// credentials never reach the access log.
var tokenQueryPattern = regexp.MustCompile(`(?i)(token=)[^&\s]*`)

// redactTokenQuery masks the token query parameter of a logged request path.
func redactTokenQuery(path string) string {
	return tokenQueryPattern.ReplaceAllString(path, "${1}***")
}

// RequestLogger is gin's logger with the websocket token query redacted.
func RequestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(p gin.LogFormatterParams) string {
		log := fmt.Sprintf("[GIN] %v |%3d| %13v | %15s |%-7s %#v",
			p.TimeStamp.Format("2006/01/02 - 15:04:05"),
			p.StatusCode,
			p.Latency,
			p.ClientIP,
			p.Method,
			redactTokenQuery(p.Path),
		)
		if p.ErrorMessage != "" {
			log += "\n" + p.ErrorMessage
		}
		return log + "\n"
	})
}
