def test_post_model_creation():
    from post_service.schemas.post import PostCreate

    post = PostCreate(
        title="Hello",
        content="World"
    )

    assert post.title == "Hello"