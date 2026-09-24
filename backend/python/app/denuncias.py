from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user


router = APIRouter(
    prefix="/denuncias",
    tags=["Denúncias"]
)


class DenunciaCreate(BaseModel):
    title: str
    description: str
    category: str
    location: str
    latitude: float | None = None
    longitude: float | None = None


class DenunciaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None


@router.post("/")
def create_denuncia(
    data: DenunciaCreate,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        denuncia = {
            "user_id": current_user.id,
            "title": data.title,
            "description": data.description,
            "category": data.category,
            "location": data.location,
            "latitude": data.latitude,
            "longitude": data.longitude,
        }

        response = (
            client
            .table("denuncias")
            .insert(denuncia)
            .execute()
        )

        return {
            "message": "Denúncia criada com sucesso.",
            "denuncia": response.data[0]
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get("/")
def list_denuncias(
    auth_data=Depends(get_current_user)
):
    client = auth_data["client"]

    try:
        response = (
            client
            .table("denuncias")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "denuncias": response.data
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get("/{denuncia_id}")
def get_denuncia(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    client = auth_data["client"]

    try:
        response = (
            client
            .table("denuncias")
            .select("*")
            .eq("id", denuncia_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Denúncia não encontrada."
            )

        return response.data

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Denúncia não encontrada."
        )


@router.patch("/{denuncia_id}")
def update_denuncia(
    denuncia_id: str,
    data: DenunciaUpdate,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        existing = (
            client
            .table("denuncias")
            .select("user_id")
            .eq("id", denuncia_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Denúncia não encontrada."
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode editar suas próprias denúncias."
            )

        update_data = data.model_dump(exclude_unset=True)

        response = (
            client
            .table("denuncias")
            .update(update_data)
            .eq("id", denuncia_id)
            .execute()
        )

        return {
            "message": "Denúncia atualizada com sucesso.",
            "denuncia": response.data[0]
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.delete("/{denuncia_id}")
def delete_denuncia(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        existing = (
            client
            .table("denuncias")
            .select("user_id")
            .eq("id", denuncia_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Denúncia não encontrada."
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode excluir suas próprias denúncias."
            )

        client.table("denuncias").delete().eq(
            "id", denuncia_id
        ).execute()

        return {
            "message": "Denúncia excluída com sucesso."
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )