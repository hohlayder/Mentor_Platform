package client

import (
	"context"

	postsv1 "github.com/Sergey-1214/contracts_mentors/post/v1"
	"google.golang.org/grpc"
)

type PostClient struct {
	Client postsv1.PostServiceClient
	conn *grpc.ClientConn
}

func NewPostClient(conn *grpc.ClientConn) *PostClient{
	return &PostClient{
		Client: postsv1.NewPostServiceClient(conn),
		conn: conn,
	}
}

func (c *PostClient) CreatePost(ctx context.Context, in *postsv1.CreatePostRequest) (*postsv1.CreatePostResponse, error) {
	return c.Client.CreatePost(ctx, in)
}

func (c *PostClient) GetPost(ctx context.Context, in *postsv1.GetPostRequest) (*postsv1.GetPostResponse, error) {
	return c.Client.GetPost(ctx, in)
}

func (c *PostClient) UpdatePost(ctx context.Context, in *postsv1.UpdatePostRequest) (*postsv1.UpdatePostResponse, error) {
	return c.Client.UpdatePost(ctx, in)
}

func (c *PostClient) DeletePost(ctx context.Context, in *postsv1.DeletePostRequest) (*postsv1.DeletePostResponse, error) {
	return c.Client.DeletePost(ctx, in)
}

func (c *PostClient) RatePost(ctx context.Context, in *postsv1.RatePostRequest) (*postsv1.RatePostResponse, error) {
	return c.Client.RatePost(ctx, in)
}

func (c *PostClient) ListPosts(ctx context.Context, in *postsv1.ListPostsRequest) (*postsv1.ListPostsResponse, error) {
	return c.Client.ListPosts(ctx, in)
}

func (c *PostClient) GetPostRatings(ctx context.Context, in *postsv1.GetPostRatingsRequest) (*postsv1.GetPostRatingsResponse, error) {
	return c.Client.GetPostRatings(ctx, in)
}

func (c *PostClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}