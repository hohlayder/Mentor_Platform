package redis

import (
	"context"
	"encoding/json"

	"github.com/hohlayder/Mentor_Platform/chat_service/internal/domain"
	"github.com/redis/go-redis/v9"
)

type Client struct {
    client *redis.Client
}

func NewRedisClient(addr, password string, db int) *Client {
    return &Client{
        client: redis.NewClient(&redis.Options{
            Addr:     addr,
            Password: password,
            DB:       db,
        }),
    }
}

func (c *Client) Subscribe(ctx context.Context, channels ...string) <-chan *redis.Message {
    pubsub := c.client.Subscribe(ctx, channels...)
    return pubsub.Channel()
}

func (c *Client) Publish(ctx context.Context, channel string, message *domain.Message) error {
    data, err := json.Marshal(message)
    if err != nil {
        return err
    }
    return c.client.Publish(ctx, channel, data).Err()
}

func (c *Client) Close() error {
    return c.client.Close()
}