package domain

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Cursor struct {
	ID        uuid.UUID    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

func (c *Cursor) Encode() string {
	if c == nil {
		return ""
	}
	data, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(data)
}

func DecodeCursor(cursorStr string) (*Cursor, error) {
	if cursorStr == "" {
		return nil, nil
	}
	
	data, err := base64.URLEncoding.DecodeString(cursorStr)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor encoding: %w", err)
	}
	
	var cursor Cursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return nil, fmt.Errorf("invalid cursor format: %w", err)
	}
	
	return &cursor, nil
}
