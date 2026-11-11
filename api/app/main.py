from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.config import get_settings
from app.deps import require_admin_enabled
from app.routers import admin_content, admin_taxonomy, public

settings = get_settings()
if settings.admin_dev_mode and settings.is_production:
    raise RuntimeError("ADMIN_DEV_MODE must not be enabled in production (admin has no sign-in yet)")

app = FastAPI(title="Gradient Garage API", version="0.1.0")
errors.install(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

v1 = APIRouter(prefix="/api/v1")
v1.include_router(public.router)

admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin_enabled)])
admin.include_router(admin_content.router)
admin.include_router(admin_taxonomy.router)
v1.include_router(admin)

app.include_router(v1)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
