import os

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")


if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL não foi configurada.")


if not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("SUPABASE_PUBLISHABLE_KEY não foi configurada.")


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
)


def get_authenticated_client(access_token: str) -> Client:
    client: Client = create_client(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
    )

    client.postgrest.auth(access_token)

    return client