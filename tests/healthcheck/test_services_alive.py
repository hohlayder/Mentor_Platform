import pytest
from httpx import AsyncClient

SERVICES = [
    ("auth_service.main", "/health"),
    ("user_service.main", "/health"),
]

@pytest.mark.asyncio
@pytest.mark.parametrize("module,endpoint", SERVICES)
async def test_service_health(module, endpoint):
    mod = __import__(module, fromlist=["app"])
    app = mod.app

    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(endpoint)

    assert response.status_code in (200, 404)