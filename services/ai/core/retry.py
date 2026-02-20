from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


def retry_async(attempts: int = 3):
    return retry(
        reraise=True,
        stop=stop_after_attempt(attempts),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(Exception),
    )
