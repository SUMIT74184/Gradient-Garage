"""Sign-in, sign-up, sessions, email verification, invites, password resets and the team list.

Tokens (session, invite, reset) are random 256-bit values; only their SHA-256 is stored,
so a database leak doesn't hand out working links or sessions.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import BackgroundTasks
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session as DbSession

from app.config import get_settings
from app.errors import AppError, Conflict, Forbidden, Invalid, NotFound
from app.models import ROLE_RANK, TEAM_ROLES, EmailVerification, Invite, LoginAttempt, OAuthAccount, PasswordReset, Role, Session, User
from app.services import email as mail
from app.services.history import audit

_hasher = PasswordHasher()
# Verified against when the email is unknown, so timing doesn't reveal which emails exist
_DUMMY_HASH = _hasher.hash("not-a-real-password")

PROVIDERS = {"github", "google"}


class Unauthorized(AppError):
    status_code = 401


class TooManyAttempts(AppError):
    status_code = 429


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def norm_email(email: str) -> str:
    return email.strip().lower()


def check_password_strength(password: str, email: str = "") -> None:
    s = get_settings()
    if len(password) < s.min_password_length:
        raise Invalid(f"password must be at least {s.min_password_length} characters", errors=[{"loc": ["password"], "msg": f"At least {s.min_password_length} characters"}])
    if email and password.lower() == email.lower():
        raise Invalid("password can't be your email", errors=[{"loc": ["password"], "msg": "Can't be your email"}])


def set_password(user: User, password: str) -> None:
    check_password_strength(password, user.email)
    user.password_hash = _hasher.hash(password)


# ---------- sessions ----------


def create_session(db: DbSession, user: User, *, ip: str = "", user_agent: str = "") -> tuple[str, Session]:
    token, token_hash = new_token()
    sess = Session(
        token_hash=token_hash,
        user_id=user.id,
        expires_at=now() + timedelta(days=get_settings().session_days),
        ip=ip[:64],
        user_agent=user_agent[:400],
    )
    db.add(sess)
    user.last_login_at = now()
    db.flush()
    return token, sess


def user_for_token(db: DbSession, token: str) -> User:
    sess = db.scalar(select(Session).where(Session.token_hash == hash_token(token)))
    if sess is None or sess.expires_at <= now():
        raise Unauthorized("session expired; sign in again")
    user = db.get(User, sess.user_id)
    if user is None or not user.is_active:
        raise Unauthorized("account is disabled")
    # Sliding expiry, written at most every 10 minutes
    if now() - sess.last_seen_at > timedelta(minutes=10):
        sess.last_seen_at = now()
        sess.expires_at = now() + timedelta(days=get_settings().session_days)
        db.commit()
    return user


def end_session(db: DbSession, token: str) -> None:
    db.execute(delete(Session).where(Session.token_hash == hash_token(token)))


def end_all_sessions(db: DbSession, user_id: uuid.UUID, keep_token: str | None = None) -> None:
    stmt = delete(Session).where(Session.user_id == user_id)
    if keep_token:
        stmt = stmt.where(Session.token_hash != hash_token(keep_token))
    db.execute(stmt)


# ---------- password sign-in ----------


def _check_rate_limit(db: DbSession, email: str, ip: str) -> None:
    s = get_settings()
    since = now() - timedelta(minutes=s.login_window_minutes)
    by_email = db.scalar(select(func.count()).where(LoginAttempt.email == email, LoginAttempt.created_at > since)) or 0
    by_ip = (
        db.scalar(select(func.count()).where(LoginAttempt.ip == ip, LoginAttempt.created_at > since)) or 0 if ip else 0
    )
    # Per-IP allows more, since a team can share an office IP
    if by_email >= s.login_max_failures or by_ip >= s.login_max_failures * 4:
        raise TooManyAttempts(f"too many failed attempts; try again in {s.login_window_minutes} minutes")


def login(db: DbSession, email: str, password: str, *, ip: str = "", user_agent: str = "") -> tuple[str, User]:
    email = norm_email(email)
    _check_rate_limit(db, email, ip)
    user = db.scalar(select(User).where(User.email == email))
    ok = False
    try:
        ok = _hasher.verify(user.password_hash if user and user.password_hash else _DUMMY_HASH, password)
    except (VerifyMismatchError, InvalidHashError):
        ok = False
    if not ok or user is None or not user.password_hash or not user.is_active:
        db.add(LoginAttempt(email=email, ip=ip[:64]))
        db.commit()
        raise Unauthorized("wrong email or password")
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = _hasher.hash(password)
    db.execute(delete(LoginAttempt).where(LoginAttempt.email == email))
    token, _ = create_session(db, user, ip=ip, user_agent=user_agent)
    audit(db, actor=user, action="auth.login", entity_type="user", entity_id=str(user.id), entity_label=user.email, changes={"method": "password"})
    return token, user


# ---------- public sign-up & email verification ----------


def _recent_count(db: DbSession, model, user_id: uuid.UUID) -> int:
    since = now() - timedelta(hours=1)
    return db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id, model.created_at > since)) or 0


def send_verification(db: DbSession, user: User, bg: BackgroundTasks) -> None:
    if user.email_verified_at:
        raise Conflict("your email is already confirmed")
    if _recent_count(db, EmailVerification, user.id) >= get_settings().email_hourly_limit:
        raise TooManyAttempts("we've sent a few emails already; check your inbox (and spam), or try again in an hour")
    token, token_hash = new_token()
    db.add(
        EmailVerification(
            token_hash=token_hash, user_id=user.id, email=user.email,
            expires_at=now() + timedelta(hours=get_settings().verify_hours),
        )
    )
    db.flush()
    bg.add_task(mail.send, user.email, *mail.verification_email(user.email, token))


def signup(db: DbSession, *, name: str, email: str, password: str, bg: BackgroundTasks, ip: str = "", user_agent: str = "") -> tuple[str, User]:
    s = get_settings()
    if not s.allow_signup:
        raise Forbidden("sign-up is closed")
    email = norm_email(email)
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise Invalid("enter a valid email", errors=[{"loc": ["email"], "msg": "Enter a valid email"}])
    # Light spam guard: a handful of sign-ups per IP per hour
    if ip:
        since = now() - timedelta(hours=1)
        recent = db.scalar(select(func.count()).where(LoginAttempt.email == "signup", LoginAttempt.ip == ip[:64], LoginAttempt.created_at > since)) or 0
        if recent >= 5:
            raise TooManyAttempts("too many sign-ups from this network; try again later")
    if db.scalar(select(User).where(User.email == email)):
        raise Conflict("an account with this email already exists. Sign in, or reset your password if you forgot it.", errors=[{"loc": ["email"], "msg": "Already registered"}])
    user = User(email=email, name=name.strip()[:200], role=Role.member, is_active=True)
    set_password(user, password)
    db.add(user)
    db.add(LoginAttempt(email="signup", ip=ip[:64]))
    db.flush()
    send_verification(db, user, bg)
    token, _ = create_session(db, user, ip=ip, user_agent=user_agent)
    audit(db, actor=user, action="auth.signup", entity_type="user", entity_id=str(user.id), entity_label=user.email)
    return token, user


def verify_email(db: DbSession, token: str) -> User:
    v = db.scalar(select(EmailVerification).where(EmailVerification.token_hash == hash_token(token)))
    if v is None or v.used_at or v.expires_at <= now():
        raise NotFound("this confirmation link isn't valid anymore; sign in and send a new one")
    user = db.get(User, v.user_id)
    if user is None or user.email != v.email:
        raise NotFound("this confirmation link isn't valid anymore")
    v.used_at = now()
    if not user.email_verified_at:
        user.email_verified_at = now()
    return user


def forgot_password(db: DbSession, email: str, bg: BackgroundTasks) -> None:
    """Always looks the same to the caller, whether or not the email has an account."""
    user = db.scalar(select(User).where(User.email == norm_email(email)))
    if user is None or not user.is_active or user.email == "system@localhost":
        return
    if _recent_count(db, PasswordReset, user.id) >= get_settings().email_hourly_limit:
        return
    token, token_hash = new_token()
    db.add(PasswordReset(token_hash=token_hash, user_id=user.id, expires_at=now() + timedelta(hours=get_settings().reset_hours)))
    db.flush()
    bg.add_task(mail.send, user.email, *mail.reset_email(user.email, token))


def delete_own_account(db: DbSession, user: User, *, password: str | None, confirm_email: str | None) -> None:
    if user.role is not Role.member:
        raise Conflict("team accounts are removed by an Owner from the Team page")
    if user.password_hash:
        try:
            _hasher.verify(user.password_hash, password or "")
        except (VerifyMismatchError, InvalidHashError) as e:
            raise Invalid("wrong password", errors=[{"loc": ["password"], "msg": "Wrong password"}]) from e
    elif norm_email(confirm_email or "") != user.email:
        raise Invalid("type your email to confirm", errors=[{"loc": ["confirmEmail"], "msg": "Doesn't match your email"}])
    audit(db, actor=None, action="auth.delete_account", entity_type="user", entity_id=str(user.id), entity_label=user.email)
    db.delete(user)


# ---------- invites ----------


def _invite_by_token(db: DbSession, token: str) -> Invite:
    inv = db.scalar(select(Invite).where(Invite.token_hash == hash_token(token)))
    if inv is None or inv.revoked_at or inv.accepted_at:
        raise NotFound("this invite link isn't valid anymore")
    if inv.expires_at <= now():
        raise NotFound("this invite link has expired; ask for a new one")
    return inv


def peek_invite(db: DbSession, token: str) -> Invite:
    return _invite_by_token(db, token)


def create_invite(db: DbSession, email: str, role: Role, actor: User, bg: BackgroundTasks | None = None) -> tuple[str, Invite]:
    if role not in TEAM_ROLES:
        raise Invalid("invites are for team roles; members sign up themselves")
    email = norm_email(email)
    existing = db.scalar(select(User).where(User.email == email))
    if existing and existing.role is Role.member:
        raise Conflict("this person already has a site account; give them a team role from the Members list")
    if existing:
        raise Conflict("someone with this email is already on the team")
    # A new invite replaces any pending one for the same email
    for old in db.scalars(select(Invite).where(Invite.email == email, Invite.accepted_at.is_(None), Invite.revoked_at.is_(None))):
        old.revoked_at = now()
    token, token_hash = new_token()
    inv = Invite(
        token_hash=token_hash,
        email=email,
        role=role,
        invited_by_id=actor.id,
        expires_at=now() + timedelta(days=get_settings().invite_days),
    )
    db.add(inv)
    db.flush()
    audit(db, actor=actor, action="invite.create", entity_type="invite", entity_id=str(inv.id), entity_label=email, changes={"role": role.value})
    if bg is not None:
        bg.add_task(mail.send, email, *mail.invite_email(email, token, role.value, actor.name or actor.email))
    return token, inv


def revoke_invite(db: DbSession, invite_id: uuid.UUID, actor: User) -> None:
    inv = db.get(Invite, invite_id)
    if inv is None or inv.accepted_at:
        raise NotFound("invite not found")
    inv.revoked_at = now()
    audit(db, actor=actor, action="invite.revoke", entity_type="invite", entity_id=str(inv.id), entity_label=inv.email)


def _create_user_from_invite(db: DbSession, inv: Invite, name: str) -> User:
    if db.scalar(select(User).where(User.email == inv.email)):
        raise Conflict("an account with this email already exists; sign in instead")
    # The invite link was delivered to this address, so it counts as confirmed
    user = User(email=inv.email, name=name.strip()[:200], role=inv.role, is_active=True, email_verified_at=now())
    db.add(user)
    inv.accepted_at = now()
    db.flush()
    audit(db, actor=user, action="invite.accept", entity_type="user", entity_id=str(user.id), entity_label=user.email, changes={"role": inv.role.value})
    return user


def accept_invite(db: DbSession, token: str, name: str, password: str, *, ip: str = "", user_agent: str = "") -> tuple[str, User]:
    inv = _invite_by_token(db, token)
    check_password_strength(password, inv.email)
    user = _create_user_from_invite(db, inv, name)
    set_password(user, password)
    session_token, _ = create_session(db, user, ip=ip, user_agent=user_agent)
    return session_token, user


# ---------- password resets ----------


def create_reset(db: DbSession, user_id: uuid.UUID, actor: User, bg: BackgroundTasks | None = None) -> tuple[str, PasswordReset]:
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("user not found")
    token, token_hash = new_token()
    reset = PasswordReset(
        token_hash=token_hash, user_id=user.id, created_by_id=actor.id,
        expires_at=now() + timedelta(hours=get_settings().reset_hours),
    )
    db.add(reset)
    db.flush()
    audit(db, actor=actor, action="user.reset_link", entity_type="user", entity_id=str(user.id), entity_label=user.email)
    if bg is not None:
        bg.add_task(mail.send, user.email, *mail.reset_email(user.email, token))
    return token, reset


def _reset_by_token(db: DbSession, token: str) -> tuple[PasswordReset, User]:
    reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == hash_token(token)))
    if reset is None or reset.used_at or reset.expires_at <= now():
        raise NotFound("this reset link isn't valid anymore; ask an Owner for a new one")
    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        raise NotFound("this account is disabled")
    return reset, user


def peek_reset(db: DbSession, token: str) -> User:
    return _reset_by_token(db, token)[1]


def use_reset(db: DbSession, token: str, password: str, *, ip: str = "", user_agent: str = "") -> tuple[str, User]:
    reset, user = _reset_by_token(db, token)
    set_password(user, password)
    reset.used_at = now()
    if not user.email_verified_at:
        user.email_verified_at = now()  # the link reached this inbox
    end_all_sessions(db, user.id)  # signs out any session an attacker may hold
    db.execute(delete(LoginAttempt).where(LoginAttempt.email == user.email))
    session_token, _ = create_session(db, user, ip=ip, user_agent=user_agent)
    audit(db, actor=user, action="user.password_reset", entity_type="user", entity_id=str(user.id), entity_label=user.email)
    return session_token, user


# ---------- OAuth ----------


def oauth_sign_in(
    db: DbSession,
    *,
    provider: str,
    provider_user_id: str,
    email: str,
    email_verified: bool,
    name: str = "",
    avatar_url: str | None = None,
    invite_token: str | None = None,
    ip: str = "",
    user_agent: str = "",
) -> tuple[str, User]:
    """Sign in with an identity the website already verified with GitHub / Google.

    Invite-only: the account must already exist, or the invite must be for this exact email.
    """
    if provider not in PROVIDERS:
        raise Invalid("unknown provider")
    email = norm_email(email)
    if not email or not email_verified:
        raise Forbidden(f"your {provider} email isn't verified")

    link = db.scalar(select(OAuthAccount).where(OAuthAccount.provider == provider, OAuthAccount.provider_user_id == provider_user_id))
    if link:
        user = db.get(User, link.user_id)
    else:
        user = db.scalar(select(User).where(User.email == email))
        if user is None and invite_token:
            inv = _invite_by_token(db, invite_token)
            if inv.email != email:
                raise Forbidden(f"this invite is for {inv.email}, but your {provider} email is {email}")
            user = _create_user_from_invite(db, inv, name)
        if user is None:
            if not get_settings().allow_signup:
                raise Forbidden(f"no account for {email}. Ask an Owner for an invite.")
            user = User(email=email, name=name.strip()[:200], role=Role.member, is_active=True, email_verified_at=now())
            db.add(user)
            db.flush()
            audit(db, actor=user, action="auth.signup", entity_type="user", entity_id=str(user.id), entity_label=email, changes={"method": provider})
        elif user.email_verified_at is None:
            # Someone registered this address with a password but never confirmed it. The provider
            # just proved who owns the inbox, so drop that password and its sessions.
            user.password_hash = None
            end_all_sessions(db, user.id)
            user.email_verified_at = now()
        user.oauth_accounts.append(OAuthAccount(provider=provider, provider_user_id=provider_user_id, email=email))
    if user is None or not user.is_active:
        raise Forbidden("this account is disabled")
    if avatar_url and not user.avatar_url:
        user.avatar_url = avatar_url[:1000]
    if name and not user.name:
        user.name = name[:200]
    token, _ = create_session(db, user, ip=ip, user_agent=user_agent)
    audit(db, actor=user, action="auth.login", entity_type="user", entity_id=str(user.id), entity_label=user.email, changes={"method": provider})
    return token, user


def unlink_oauth(db: DbSession, user: User, provider: str) -> None:
    accounts = [a for a in user.oauth_accounts if a.provider == provider]
    if not accounts:
        raise NotFound(f"no {provider} account linked")
    others = len(user.oauth_accounts) - len(accounts)
    if not user.password_hash and others == 0:
        raise Conflict("set a password first, or you'd have no way to sign in")
    for a in accounts:
        user.oauth_accounts.remove(a)


# ---------- team ----------


def user_out(user: User, *, sessions: int | None = None) -> dict:
    out = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "isActive": user.is_active,
        "avatarUrl": user.avatar_url,
        "hasPassword": bool(user.password_hash),
        "emailVerified": user.email_verified_at is not None,
        "isTeam": user.role in TEAM_ROLES,
        "providers": sorted({a.provider for a in user.oauth_accounts}),
        "lastLoginAt": user.last_login_at.isoformat() if user.last_login_at else None,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }
    if sessions is not None:
        out["sessions"] = sessions
    return out


def _active_owners(db: DbSession) -> int:
    return db.scalar(select(func.count()).where(User.role == Role.owner, User.is_active.is_(True))) or 0


def update_member(db: DbSession, user_id: uuid.UUID, actor: User, *, role: Role | None = None, is_active: bool | None = None) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFound("user not found")
    if user.id == actor.id:
        raise Conflict("you can't change your own role or disable yourself")
    losing_owner = user.role is Role.owner and user.is_active and ((role is not None and role is not Role.owner) or is_active is False)
    if losing_owner and _active_owners(db) <= 1:
        raise Conflict("the team needs at least one active Owner")
    changes = {}
    if role is not None and role is not user.role:
        changes["role"] = [user.role.value, role.value]
        user.role = role
    if is_active is not None and is_active != user.is_active:
        changes["isActive"] = [user.is_active, is_active]
        user.is_active = is_active
        if not is_active:
            end_all_sessions(db, user.id)
    if changes:
        audit(db, actor=actor, action="user.update", entity_type="user", entity_id=str(user.id), entity_label=user.email, changes=changes)
    return user


def has_role(user: User, need: Role) -> bool:
    return ROLE_RANK[user.role] >= ROLE_RANK[need]
