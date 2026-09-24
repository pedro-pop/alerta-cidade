from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import require_role


router = APIRouter(
    prefix="/moderacao",
    tags=["Moderação"]
)


class StatusUpdate(BaseModel):
    status: str


class OfficialResponse(BaseModel):
    response: str


@router.get("/denuncias")
def list_all_denuncias(
    profile=Depends(require_role("moderador", "admin", "superadmin"))
):
    from app.supabase_client import get_authenticated_client

    # O cliente autenticado será obtido através do token
    # nas próximas etapas de integração completa.
    return {
        "message": "Área de moderação disponível.",
        "moderator": profile
    }


@router.patch("/denuncias/{denuncia_id}/status")
def update_status(
    denuncia_id: str,
    data: StatusUpdate,
    profile=Depends(require_role("moderador", "admin", "superadmin"))
):
    return {
        "message": "Endpoint de alteração de status criado.",
        "denuncia_id": denuncia_id,
        "status": data.status,
        "moderator": profile["id"]
    }


@router.patch("/denuncias/{denuncia_id}/resposta")
def official_response(
    denuncia_id: str,
    data: OfficialResponse,
    profile=Depends(require_role("moderador", "admin", "superadmin"))
):
    return {
        "message": "Endpoint de resposta oficial criado.",
        "denuncia_id": denuncia_id,
        "response": data.response,
        "moderator": profile["id"]
    }