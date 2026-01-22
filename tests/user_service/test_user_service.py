import pytest

def test_create_user_entity():
    from user_service.schemas.user import UserCreate

    user = UserCreate(
        email="user@test.com",
        password="password",
        full_name="Test User"
    )

    assert user.email == "user@test.com"
    assert user.full_name == "Test User"