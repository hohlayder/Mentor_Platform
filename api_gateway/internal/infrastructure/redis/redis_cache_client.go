package redis

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

func NewClient(addr, password string, db int) *Client{
	rdb := redis.NewClient(&redis.Options{
        Addr:     addr,
        Password: password,
        DB:       db,
    })

    return &Client{
        client: rdb, 
    }
}

func (c *Client) Ping() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
	
    return c.client.Ping(ctx).Err()
}

func (c *Client) Close() error {
    return c.client.Close()
}