"""Ghost Codex - Metadata shredding and privacy tools."""

from fastapi import APIRouter
from . import routes

router = APIRouter()
router.include_router(routes.router)
