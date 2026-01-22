import pytest

def test_password_hashing():
    from auth_service.services.password import hash_password, verify_password

    password = "StrongPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong", hashed) is False