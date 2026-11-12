"""Shapes of the editable site documents (site settings, section names, landing copy).

The API validates and stores them; the defaults live in the web app
(web/src/lib/content/defaults.ts) so there's one source for the starting copy.

Text fields accept a tiny markup the site renders: *orange*, _dim_, ~underlined~, `code`,
and placeholders like {name}, {license}, {author}, {models}, {tasks}, {fineTunes}.
"""

from typing import Annotated

from pydantic import Field, field_validator

from app.schemas.content import CamelModel

Short = Annotated[str, Field(max_length=200)]
Text_ = Annotated[str, Field(max_length=4000)]
Name = Annotated[str, Field(min_length=1, max_length=80)]


def _url(v: str) -> str:
    if v and not v.startswith(("https://", "http://")):
        raise ValueError("must be an http(s) URL")
    return v


class SiteSettings(CamelModel):
    name: Name
    mark: Annotated[str, Field(min_length=1, max_length=3)]
    tagline: Short = ""
    author: Short = ""
    author_role: Short = ""
    github_url: Short = ""
    license: Annotated[str, Field(max_length=40)] = "MIT"

    @field_validator("github_url")
    @classmethod
    def _check_url(cls, v: str) -> str:
        return _url(v)


class SectionName(CamelModel):
    label: Annotated[str, Field(min_length=1, max_length=40)]
    item: Annotated[str, Field(min_length=1, max_length=40)]
    blurb: Annotated[str, Field(max_length=120)] = ""


class Sections(CamelModel):
    model: SectionName
    demo: SectionName
    dataset: SectionName
    library: SectionName


class Scene(CamelModel):
    """An image on the site. `src` must be same-origin (/scenes/… or /media/…) so the particle canvas can read it."""

    src: Annotated[str, Field(min_length=2, max_length=300, pattern=r"^/[A-Za-z0-9._\-/]+$")]
    title: Short = ""
    credit: Short = ""
    href: Short = ""

    @field_validator("href")
    @classmethod
    def _check_url(cls, v: str) -> str:
        return _url(v)


class Hero(CamelModel):
    headline_top: Short
    headline_bottom: Short
    subtitle: Text_ = ""
    primary_cta: Annotated[str, Field(min_length=1, max_length=60)]
    secondary_cta: Annotated[str, Field(min_length=1, max_length=60)]
    scenes: Annotated[list[Scene], Field(min_length=1, max_length=8)]


class TextBlock(CamelModel):
    text: Text_


class StringList(CamelModel):
    items: Annotated[list[Annotated[str, Field(min_length=1, max_length=80)]], Field(max_length=30)]


class WhatIs(CamelModel):
    title: Short
    body: Text_
    footnote: Short = ""


class TryIt(CamelModel):
    title: Short
    words: Annotated[list[Annotated[str, Field(min_length=1, max_length=30)]], Field(min_length=1, max_length=10)]
    note: Short = ""
    blurb: Text_ = ""
    image: Scene


class Feature(CamelModel):
    title: Short
    body: Text_
    cta: Annotated[str, Field(max_length=60)] = ""


class Features(CamelModel):
    # One per motion graphic on the page, so always four
    items: Annotated[list[Feature], Field(min_length=4, max_length=4)]


class CallOut(CamelModel):
    title: Short
    body: Text_
    cta: Annotated[str, Field(max_length=60)] = ""


class FaqItem(CamelModel):
    q: Annotated[str, Field(min_length=1, max_length=300)]
    a: Text_


class Faq(CamelModel):
    items: Annotated[list[FaqItem], Field(max_length=30)]


class Footer(CamelModel):
    note: Short


# key → (schema, role needed to edit). Owners manage site identity; editors can change copy.
HfAccount = Annotated[str, Field(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9][A-Za-z0-9._\-]*$")]


class SyncSettings(CamelModel):
    """What the sync job imports. Admin-only (never in the public site API)."""

    hf_authors: Annotated[list[HfAccount], Field(max_length=10)] = []
    import_models: bool = True
    import_datasets: bool = True
    import_demos: bool = True
    # Refresh GitHub stars / PyPI + npm versions for Toolkit items
    refresh_libraries: bool = True

    @field_validator("hf_authors")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(a.strip() for a in v))


# Keys only the admin panel sees
PRIVATE_SITE_KEYS = {"sync"}

SITE_KEYS: dict[str, tuple[type[CamelModel], str]] = {
    "sync": (SyncSettings, "owner"),
    "site": (SiteSettings, "owner"),
    "sections": (Sections, "owner"),
    "landing.hero": (Hero, "editor"),
    "landing.stack": (StringList, "editor"),
    "landing.manifesto": (TextBlock, "editor"),
    "landing.whatIs": (WhatIs, "editor"),
    "landing.tryIt": (TryIt, "editor"),
    "landing.quote": (TextBlock, "editor"),
    "landing.features": (Features, "editor"),
    "landing.openSource": (CallOut, "editor"),
    "landing.faq": (Faq, "editor"),
    "landing.footer": (Footer, "editor"),
}


class SitePut(CamelModel):
    # 0 when the key has never been saved (the site is using its built-in default)
    version: int
    value: dict
