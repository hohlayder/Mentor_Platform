package logger

import (
	"log/slog"
	"os"
)

func SetupJSONLogger() {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     slog.LevelInfo, 
		AddSource: true,          
	})

	logger := slog.New(handler)
	slog.SetDefault(logger)
}