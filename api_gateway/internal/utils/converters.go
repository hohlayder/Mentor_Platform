package utils

import (
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

func StringToUUID(s string) uuid.UUID {
	if s == "" {
		return uuid.Nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil
	}
	return id
}

func UUIDPtr(u uuid.UUID) *uuid.UUID {
	if u == uuid.Nil {
		return nil
	}
	return &u
}

func StringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func TimePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func BoolPtr(b bool) *bool {
	return &b
}

// Для работы с курсорами
func ParseCursor(cursorStr string) (*domain.Cursor, error) {
	if cursorStr == "" {
		return nil, nil
	}

	data, err := base64.URLEncoding.DecodeString(cursorStr)
	if err != nil {
		return nil, err
	}

	var cursor domain.Cursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return nil, err
	}

	return &cursor, nil
}

func EncodeCursor(cursor *domain.Cursor) (string, error) {
	if cursor == nil {
		return "", nil
	}

	data, err := json.Marshal(cursor)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(data), nil
}