from aiolimiter import AsyncLimiter


class RateLimiter:
    def __init__(self, rpm: int) -> None:
        self._limiter = AsyncLimiter(rpm, time_period=60)

    async def __aenter__(self):
        await self._limiter.acquire()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False
