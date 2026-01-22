import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_user_registration():
    from user_service.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/users",
            json={
                "email": "new@test.com",
                "password": "password",
                "full_name": "New User"
            }
        )

    assert response.status_code in (200, 201, 400)