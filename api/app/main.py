from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import errors
from app.config import get_settings
from app.deps import require_role
from app.models import Role
from app.routers import admin_content, admin_media, admin_site, admin_taxonomy, admin_tools, admin_users, auth, public
from app.storage import get_storage

settings = get_settings()
if settings.is_production and len(settings.internal_api_secret) < 32:
    raise RuntimeError("set INTERNAL_API_SECRET (32+ random characters) in production; the website uses it for GitHub/Google sign-in")
if settings.is_production and not settings.smtp_host:
    # Without SMTP, emails (with verify/reset/invite links) would be written to the outbox folder
    # inside the container instead of being delivered
    raise RuntimeError("set SMTP_HOST in production; sign-up confirmation, password resets and invites are sent by email")

app = FastAPI(title="Gradient Garage API", version="0.1.0")
errors.install(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    return response


v1 = APIRouter(prefix="/api/v1")
v1.include_router(public.router)
v1.include_router(auth.router)

# Every admin route needs a team member (Viewer or above); write routes also check the role.
# Public "member" accounts can't reach any of it.
admin = APIRouter(prefix="/admin", dependencies=[Depends(require_role(Role.viewer))])
admin.include_router(admin_tools.router)
admin.include_router(admin_content.router)
admin.include_router(admin_taxonomy.router)
admin.include_router(admin_media.router)
admin.include_router(admin_site.router)
admin.include_router(admin_users.router)
v1.include_router(admin)

app.include_router(v1)

# Uploaded images. The website proxies /media/* here so they're same-origin for the browser.
app.mount("/media", StaticFiles(directory=get_storage().root), name="media")


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
