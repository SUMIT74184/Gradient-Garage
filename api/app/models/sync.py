"""Hugging Face / GitHub sync runs and the daily stats they record."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class SyncRun(Base):
    """One run of the sync job. `report` lists what was imported, updated, refreshed or missing."""

    __tablename__ = "sync_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    # running | succeeded | failed
    status: Mapped[str] = mapped_column(String(20), default="running")
    # "manual" (admin button) or "schedule" (cron / CLI)
    trigger: Mapped[str] = mapped_column(String(20), default="manual")
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_email: Mapped[str] = mapped_column(String(320), default="")
    report: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StatSnapshot(Base):
    """Downloads / likes / stars of one item on one day; feeds the overview chart."""

    __tablename__ = "stat_snapshots"
    __table_args__ = (UniqueConstraint("content_id", "day", name="uq_stat_snapshots_content_day"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    content_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("content_items.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    downloads: Mapped[int] = mapped_column(BigInteger, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[int] = mapped_column(Integer, default=0)
