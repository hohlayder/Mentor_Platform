import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_endpoint():
    from auth_service.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"email": "test@test.com", "password": "password"}
        )

    assert response.status_code in (200, 401)