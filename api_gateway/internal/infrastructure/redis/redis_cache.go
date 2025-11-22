package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	chatKeyPrefix   = "chat:"
	defaultExpiration = 24 * time.Hour
)

func (c *Client) SetChat(chatID, user1ID, user2ID string) error {
    ctx := context.Background()
    
    chatUsers := ChatUsers{
        User1ID: user1ID,
        User2ID: user2ID,
    }

    data, err := json.Marshal(chatUsers)
    if err != nil {
        return fmt.Errorf("failed to marshal chat users: %w", err)
    }

    key := chatKeyPrefix + chatID
    err = c.client.Set(ctx, key, data, defaultExpiration).Err()
    if err != nil {
        return fmt.Errorf("failed to set chat: %w", err)
    }

    return nil
}

func (c *Client) GetChat(chatID string) (*ChatUsers, error) {
    ctx := context.Background()
    
    key := chatKeyPrefix + chatID
    data, err := c.client.Get(ctx, key).Bytes()
    if err == redis.Nil {
        return nil, nil 
    }

    if err != nil {
        return nil, fmt.Errorf("failed to get chat: %w", err)
    }

    var chatUsers ChatUsers
    if err := json.Unmarshal(data, &chatUsers); err != nil {
        return nil, fmt.Errorf("failed to unmarshal chat users: %w", err)
    }

    return &chatUsers, nil
}

func (c *Client) DeleteChat(chatID string) error {
    ctx := context.Background()
    
    key := chatKeyPrefix + chatID
    err := c.client.Del(ctx, key).Err()
    if err != nil {
        return fmt.Errorf("failed to delete chat: %w", err)
    }
    return nil
}