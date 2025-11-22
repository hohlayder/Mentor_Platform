package redis

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type RedisBroker struct {  
	client *redis.Client
}

func NewRedisBroker(addr, password string, db int) *RedisBroker {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	return &RedisBroker{client: client}
}

func (b *RedisBroker) Publish(ctx context.Context, channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal: %w", err)
	}

	return b.client.Publish(ctx, channel, data).Err()
}

func (b *RedisBroker) Close() error {
	return b.client.Close()
}