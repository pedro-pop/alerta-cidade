from fastapi import Depends, FastAPI

from app.auth import router as auth_router
from app.denuncias import router as denuncias_router
from app.interacoes import router as interacoes_router
from app.notificacoes import router as notificacoes_router
from app.dependencies import get_current_user
from app.moderacao import router as moderacao_router
from app.supabase_client import supabase


app = FastAPI(
    title="AlertaCidade API",
    description="API do sistema de denúncias urbanas colaborativas.",
    version="1.0.0",
)


app.include_router(auth_router)
app.include_router(denuncias_router)
app.include_router(interacoes_router)
app.include_router(notificacoes_router)
app.include_router(moderacao_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "message": "AlertaCidade API funcionando!"
    }


@app.get("/health/supabase")
def health_supabase():
    try:
        supabase.storage.list_buckets()

        return {
            "status": "ok",
            "message": "FastAPI conectado ao Supabase!"
        }

    except Exception as error:
        return {
            "status": "error",
            "message": "Não foi possível conectar ao Supabase.",
            "error": str(error)
        }


@app.get("/auth/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "message": "Usuário autenticado com sucesso!",
        "user": {
            "id": current_user.id,
            "email": current_user.email
        }
    }