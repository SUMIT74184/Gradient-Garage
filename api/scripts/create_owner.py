"""Make someone an Owner.

    python -m scripts.create_owner you@example.com [--site http://localhost:3000]

- No account yet: prints a one-time invite link; open it and set a password
  (or use GitHub / Google with the same email).
- Already signed up on the site (a "member"), or on the team: promotes the account to Owner.
"""

import argparse

from sqlalchemy import select

from app.db import SessionLocal
from app.deps import get_or_create_system_user
from app.models import Role, User
from app.services import auth


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--site", default="http://localhost:3000", help="website base URL for the link")
    args = parser.parse_args()

    with SessionLocal() as db:
        email = auth.norm_email(args.email)
        user = db.scalar(select(User).where(User.email == email))
        if user is not None:
            before = user.role.value
            user.role = Role.owner
            user.is_active = True
            auth.audit(db, actor=get_or_create_system_user(db), action="user.update", entity_type="user", entity_id=str(user.id), entity_label=email, changes={"role": [before, "owner"]})
            db.commit()
            print(f"{email} is now an Owner (was {before}). Sign in at {args.site.rstrip('/')}/login, then open /admin.")
            return
        token, inv = auth.create_invite(db, email, Role.owner, get_or_create_system_user(db))
        db.commit()
        print(f"Owner invite for {email} (valid until {inv.expires_at:%Y-%m-%d %H:%M} UTC):")
        print(f"  {args.site.rstrip('/')}/admin/invite/{token}")


if __name__ == "__main__":
    main()
