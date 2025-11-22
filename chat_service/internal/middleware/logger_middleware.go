package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

func LoggingMiddleware() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()

		resp, err := handler(ctx, req)

		duration := time.Since(start)
		if err != nil {
			if st, ok := status.FromError(err); ok {
				slog.Info(fmt.Sprintf(`{"time": "%s", "method": "%s", "event": "request_error", "duration_ms": %d, "code": "%s", "message": "%s"}`,
					time.Now().Format(time.RFC3339), info.FullMethod, duration.Milliseconds(), st.Code(), st.Message()))
			} else {
				slog.Info(fmt.Sprintf(`{"time": "%s", "method": "%s", "event": "request_error", "duration_ms": %d, "message": "%s"}`,
					time.Now().Format(time.RFC3339), info.FullMethod, duration.Milliseconds(), st.Message()))
			}
		} else {
			slog.Info(fmt.Sprintf(`{"time": "%s", "method": "%s", "event": "request_success", "duration_ms": %d, "response": "%+v"}`,
				time.Now().Format(time.RFC3339), info.FullMethod, duration.Milliseconds(), resp))
		}

		return resp, err
	}
}