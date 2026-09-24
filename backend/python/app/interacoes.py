from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user


router = APIRouter(
    prefix="/interacoes",
    tags=["Comentários e Curtidas"]
)


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str


@router.post("/denuncias/{denuncia_id}/comments")
def create_comment(
    denuncia_id: str,
    data: CommentCreate,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        response = (
            client
            .table("comments")
            .insert({
                "denuncia_id": denuncia_id,
                "user_id": current_user.id,
                "content": data.content
            })
            .execute()
        )

        return {
            "message": "Comentário criado com sucesso.",
            "comment": response.data[0]
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get("/denuncias/{denuncia_id}/comments")
def list_comments(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    client = auth_data["client"]

    try:
        response = (
            client
            .table("comments")
            .select("*")
            .eq("denuncia_id", denuncia_id)
            .order("created_at")
            .execute()
        )

        return {
            "comments": response.data
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.patch("/comments/{comment_id}")
def update_comment(
    comment_id: str,
    data: CommentUpdate,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        existing = (
            client
            .table("comments")
            .select("user_id")
            .eq("id", comment_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Comentário não encontrado."
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode editar seus próprios comentários."
            )

        response = (
            client
            .table("comments")
            .update({"content": data.content})
            .eq("id", comment_id)
            .execute()
        )

        return {
            "message": "Comentário atualizado com sucesso.",
            "comment": response.data[0]
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        existing = (
            client
            .table("comments")
            .select("user_id")
            .eq("id", comment_id)
            .single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=404,
                detail="Comentário não encontrado."
            )

        if existing.data["user_id"] != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Você só pode excluir seus próprios comentários."
            )

        client.table("comments").delete().eq(
            "id", comment_id
        ).execute()

        return {
            "message": "Comentário excluído com sucesso."
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.post("/denuncias/{denuncia_id}/like")
def like_denuncia(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        response = (
            client
            .table("likes")
            .insert({
                "denuncia_id": denuncia_id,
                "user_id": current_user.id
            })
            .execute()
        )

        return {
            "message": "Denúncia curtida.",
            "like": response.data[0]
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.delete("/denuncias/{denuncia_id}/like")
def unlike_denuncia(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    current_user = auth_data["user"]
    client = auth_data["client"]

    try:
        client.table("likes").delete().eq(
            "denuncia_id", denuncia_id
        ).eq(
            "user_id", current_user.id
        ).execute()

        return {
            "message": "Curtida removida."
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get("/denuncias/{denuncia_id}/likes")
def count_likes(
    denuncia_id: str,
    auth_data=Depends(get_current_user)
):
    client = auth_data["client"]

    try:
        response = (
            client
            .table("likes")
            .select("id")
            .eq("denuncia_id", denuncia_id)
            .execute()
        )

        return {
            "likes": len(response.data)
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )