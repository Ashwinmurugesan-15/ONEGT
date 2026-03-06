import functools
import logging
import traceback
import sys

logger = logging.getLogger("chrms.trace")

def trace_exceptions(func):
    """
    Decorator that logs full stack traces for any exception occurring in the decorated function.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_msg = f"Exception in {func.__module__}.{func.__name__}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            # Print to stderr for immediate visibility in console
            print(f"\n{'!'*60}\n{error_msg}\n{'!'*60}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"{'!'*60}\n", file=sys.stderr)
            
            raise e
    return wrapper

def trace_exceptions_async(func):
    """
    Async version of the decorator for async functions.
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            error_msg = f"Exception in {func.__module__}.{func.__name__} (async): {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            # Print to stderr for immediate visibility in console
            print(f"\n{'!'*60}\n{error_msg}\n{'!'*60}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            print(f"{'!'*60}\n", file=sys.stderr)
            
            raise e
    return wrapper
