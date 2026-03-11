from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path

# Load .env before ai_helper (which reads LLM_PROVIDER)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')  # Edit .env? Restart server to pick up changes.

from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import os
import base64
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import json
import httpx
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from ai_helper import llm_chat as _llm_chat
from lore_engine import lore_router, meta_router, init_lore_engine

# MongoDB connection
# Use .get() so the process starts even without the env var set; a clear
# error is surfaced at request-time (via MongoDB connection failure) rather
# than crashing the module at import/startup.
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
# Atlas SRV: use certifi CA bundle to avoid TLSV1_ALERT_INTERNAL_ERROR.
# If still failing on macOS (Python LibreSSL), set MONGO_TLS_SKIP_VERIFY=1 for local dev only.
_tls_kwargs = {}
if mongo_url.startswith('mongodb+srv://'):
    _tls_kwargs['tlsCAFile'] = certifi.where()
    if os.environ.get('MONGO_TLS_SKIP_VERIFY', '').lower() in ('1', 'true', 'yes'):
        _tls_kwargs['tlsAllowInvalidCertificates'] = True  # Local dev workaround only
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=15000,  # Fail in 15s instead of hanging
    **_tls_kwargs,
)
db = client[os.environ.get('DB_NAME', 'rainstorms_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rainstorms_secret_key_2024_v1')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# OpenAI API key for image generation (DALL-E 3)
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# Directory where generated illustration images are stored
ILLUSTRATIONS_DIR = ROOT_DIR / 'static' / 'illustrations'
try:
    ILLUSTRATIONS_DIR.mkdir(parents=True, exist_ok=True)
except OSError as _e:
    logging.warning("Could not create illustrations directory %s: %s. Illustration storage unavailable.", ILLUSTRATIONS_DIR, _e)

# Directory where generated character reference sheets are stored
CHARACTERS_DIR = ROOT_DIR / 'static' / 'characters'
try:
    CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
except OSError as _e:
    logging.warning("Could not create characters directory %s: %s. Character sheet storage unavailable.", CHARACTERS_DIR, _e)

# SagaArchitect / LoreEngine base URL for remote story-context fetch
SAGA_ARCHITECT_BASE_URL = os.environ.get('SAGA_ARCHITECT_BASE_URL', '').rstrip('/')

# Initialise LoreEngine with database and LLM callable
init_lore_engine(db, _llm_chat)

# Create the main app
app = FastAPI(title="Rainstorms API", version="1.0.0")

# Serve generated illustrations as static files (skipped in serverless environments
# where the static directory cannot be created on the read-only filesystem)
_static_dir = ROOT_DIR / "static"
try:
    _static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")
except OSError as _e:
    logging.warning("Could not mount /static directory %s: %s. Static file serving unavailable.", _static_dir, _e)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class VisualTags(BaseModel):
    hair: str = ""
    eyes: str = ""
    clothing: str = ""
    accessories: str = ""
    distinguishing_features: str = ""

class Character(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    name: str
    role: str
    personality: str
    appearance: str
    special_trait: str
    notes: str = ""
    # Visual profile fields (Character Consistency Engine)
    color_palette: str = ""      # e.g. "deep blue, silver, warm gold"
    clothing: str = ""           # e.g. "flowing quilt cape with star patterns"
    unique_traits: str = ""      # e.g. "glowing star eyes, stitched seams visible"
    reference_sheet_url: str = ""  # URL of the generated reference sheet image
    appearance_locked: bool = False  # When True, visual traits cannot be auto-changed
    visual_tags: Optional[dict] = None  # For visual consistency in illustrations
    # Lore Pool fields
    visibility: str = "private"  # private | shared_archetype | public_template | demo_only
    is_locked: bool = False
    origin_type: str = "user"  # user | demo | generated_from_pool
    shared_template_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CharacterCreate(BaseModel):
    name: str
    role: str
    personality: str
    appearance: str
    special_trait: str
    notes: str = ""
    color_palette: str = ""
    clothing: str = ""
    unique_traits: str = ""
    visual_tags: Optional[dict] = None

class PageData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    page_number: int
    outline_beat: str
    page_text: str = ""
    illustration_prompt: str = ""
    illustration_url: str = ""   # URL of the generated illustration image
    emotional_beat: str = ""
    # Page Layout Engine
    page_layout: Optional[dict] = None  # PageLayoutData dict
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PageCreate(BaseModel):
    page_number: int
    outline_beat: str
    page_text: str = ""
    illustration_prompt: str = ""
    emotional_beat: str = ""

class StoryMemory(BaseModel):
    characters: List[dict] = []  # Character summaries for consistency
    relationships: List[dict] = []  # Character relationships
    settings: List[dict] = []  # Key locations/settings
    events: List[dict] = []  # Important events that happened
    tone_notes: str = ""  # Tone consistency notes
    style_guide: str = ""  # Writing style guidelines

class BookMetadata(BaseModel):
    """Publishing metadata for a book project."""
    title: str = ""
    subtitle: str = ""
    author_name: str = ""
    pen_name: str = ""
    series_name: str = ""
    series_number: Optional[int] = None
    book_description: str = ""
    keywords: List[str] = []
    age_range: str = ""
    language: str = "en"
    publisher_name: str = ""
    publication_date: str = ""
    isbn_status: str = "none"  # none | pending | registered
    copyright_holder: str = ""


class BookFormatSettings(BaseModel):
    """Print format configuration for a book project."""
    trim_size: str = "8x8"          # 8x8 | 8.5x8.5 | 8.5x11 | 10x8
    bleed_enabled: bool = True
    paper_type: str = "standard"    # standard | premium
    cover_finish: str = "matte"     # matte | glossy
    interior_color: str = "color"   # color | bw
    font_embedding: bool = True


# Trim size → (width_inches, height_inches) mapping
_TRIM_SIZES: dict = {
    "8x8": (8.0, 8.0),
    "8.5x8.5": (8.5, 8.5),
    "8.5x11": (8.5, 11.0),
    "10x8": (10.0, 8.0),
}
# Paper thickness in inches for spine calculation (standard 50 lb paper)
_PAPER_THICKNESS_INCHES: float = 0.002252


class PublishingMetadataUpdate(BaseModel):
    """Body for PUT /publishing-center/metadata."""
    book_metadata: Optional[dict] = None
    book_format: Optional[dict] = None


# ── Illustration Style Presets ──────────────────────────────────────────────────

STYLE_PRESETS: dict = {
    "watercolor": {
        "label": "Storybook Watercolor",
        "suffix": "Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette, hand-painted look",
        "emoji": "🎨",
    },
    "pastel": {
        "label": "Soft Pastel Bedtime",
        "suffix": "Style: soft pastel bedtime illustration, dreamy muted tones, cozy warm lighting, gentle children's book art, soothing color palette",
        "emoji": "🌙",
    },
    "cartoon": {
        "label": "Cartoon Picture Book",
        "suffix": "Style: bright cartoon picture book illustration, bold outlines, vivid colors, playful expressive characters, cheerful composition",
        "emoji": "🖍️",
    },
    "flat_modern": {
        "label": "Flat Modern Illustration",
        "suffix": "Style: flat modern children's illustration, clean geometric shapes, contemporary color palette, minimalist composition, editorial picture book style",
        "emoji": "✏️",
    },
}
DEFAULT_STYLE_PRESET = "watercolor"


class IllustrationStyleUpdate(BaseModel):
    """Body for PUT /api/projects/{id}/illustration-style."""
    style_preset: str  # watercolor | pastel | cartoon | flat_modern


# ── Page Layout Engine constants + models ──────────────────────────────────────

# Supported layout types with display metadata
LAYOUT_TYPES: dict = {
    "full_illustration_text_bottom": {
        "label": "Full Illustration + Text Bottom",
        "description": "Large illustration fills the top, short text block below. Best for dramatic moments.",
        "emoji": "🖼️",
        "best_for": "dramatic moments, short text",
    },
    "full_illustration_text_overlay": {
        "label": "Full Illustration + Text Overlay",
        "description": "Full-bleed illustration with text overlaid at the bottom on a semi-transparent strip.",
        "emoji": "✨",
        "best_for": "simple short text, strong visuals",
    },
    "split_top_bottom": {
        "label": "Split Layout",
        "description": "Illustration on top half, text on bottom half with clear separation.",
        "emoji": "⬆️",
        "best_for": "longer text, dialogue",
    },
    "full_spread": {
        "label": "Full Spread",
        "description": "Two-page illustration spanning both left and right pages.",
        "emoji": "📖",
        "best_for": "climax scenes, big emotional beats",
    },
    "spot_illustration": {
        "label": "Spot Illustration",
        "description": "Small illustration inset with a larger text area.",
        "emoji": "🔍",
        "best_for": "transition scenes, text-heavy pages",
    },
}

# Preset page themes
PAGE_THEMES: dict = {
    "cozy_bedtime": {
        "label": "Cozy Bedtime",
        "emoji": "🌙",
        "font_family": "Georgia",
        "font_size_min": 28,
        "font_size_max": 38,
        "text_color": "#2C1810",
        "bg_color": "#FFF8F0",
        "overlay_color": "rgba(255,248,240,0.88)",
    },
    "bright_storybook": {
        "label": "Bright Storybook",
        "emoji": "🌈",
        "font_family": "Helvetica",
        "font_size_min": 30,
        "font_size_max": 40,
        "text_color": "#1A1A2E",
        "bg_color": "#FFFFFF",
        "overlay_color": "rgba(255,255,255,0.90)",
    },
    "watercolor_calm": {
        "label": "Watercolor Calm",
        "emoji": "🎨",
        "font_family": "Georgia",
        "font_size_min": 26,
        "font_size_max": 36,
        "text_color": "#3D2B1F",
        "bg_color": "#F5F0EB",
        "overlay_color": "rgba(245,240,235,0.87)",
    },
    "comic_adventure": {
        "label": "Comic Adventure",
        "emoji": "💥",
        "font_family": "Helvetica",
        "font_size_min": 32,
        "font_size_max": 44,
        "text_color": "#1C1C1C",
        "bg_color": "#FFFDE7",
        "overlay_color": "rgba(255,253,231,0.88)",
    },
}
DEFAULT_PAGE_THEME = "cozy_bedtime"


class PageLayoutData(BaseModel):
    """
    Layout metadata for a single page of the book.
    Coordinates are in points (72 pt = 1 inch) at 300 DPI equivalent for the
    rendered page canvas; for UI purposes treat as relative percentages when
    layout_unit == 'percent'.
    """
    layout_type: str = "full_illustration_text_bottom"
    # Bounding boxes as {x, y, width, height} in points
    image_box: dict = Field(default_factory=lambda: {"x": 0, "y": 0, "width": 576, "height": 432})
    text_box: dict = Field(default_factory=lambda: {"x": 36, "y": 450, "width": 504, "height": 108})
    font_size: int = 34
    alignment: str = "center"   # left | center | right
    # Safe-zone flags
    print_safe: bool = True      # True when margins comply with print rules
    gutter_safe: bool = True     # True for spread pages when text is clear of gutter


class PageThemeUpdate(BaseModel):
    """Body for PUT /api/projects/{id}/page-theme."""
    theme_key: str  # cozy_bedtime | bright_storybook | watercolor_calm | comic_adventure


class PageLayoutOverride(BaseModel):
    """Body for PUT /api/projects/{id}/pages/{page_id}/layout."""
    layout_type: Optional[str] = None
    font_size: Optional[int] = None
    alignment: Optional[str] = None
    image_box: Optional[dict] = None
    text_box: Optional[dict] = None


# ── Smart Cover Generator constants + models ───────────────────────────────────

# Cover style presets with display metadata
COVER_STYLES: dict = {
    "cozy_bedtime": {
        "label": "Cozy Bedtime",
        "emoji": "🌙",
        "description": "Soft lighting, warm palette, stars and moon. Perfect for gentle bedtime stories.",
        "prompt_suffix": "soft warm bedtime lighting, stars and moonlight, cozy dreamlike colors, children's book cover art, central character glowing softly",
    },
    "adventure": {
        "label": "Adventure",
        "emoji": "⚡",
        "description": "Bold colors, action pose, dynamic composition. Best for exciting tales.",
        "prompt_suffix": "bold vivid colors, dynamic action composition, heroic pose, bright children's adventure book cover, strong contrast",
    },
    "character_closeup": {
        "label": "Character Close-Up",
        "emoji": "👤",
        "description": "Main character portrait, expressive face, centered composition.",
        "prompt_suffix": "close-up portrait of main character, expressive warm eyes, centered composition, children's picture book cover, painterly illustration",
    },
    "scene": {
        "label": "Scene Cover",
        "emoji": "🏡",
        "description": "Important story moment, full scene, cinematic framing.",
        "prompt_suffix": "cinematic full scene illustration, important story moment, detailed environment, storybook atmosphere, wide composition for book cover",
    },
}
DEFAULT_COVER_STYLE = "cozy_bedtime"

# Directory for generated cover images
COVERS_DIR = ROOT_DIR / "static" / "covers"
try:
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
except OSError as _e:
    logging.warning("Could not create covers directory %s: %s. Cover image storage unavailable.", COVERS_DIR, _e)


class CoverData(BaseModel):
    """Stored cover metadata for a project."""
    cover_style: str = DEFAULT_COVER_STYLE
    concept: str = ""                    # LLM-generated visual concept
    front_cover_url: str = ""            # /static/covers/{project_id}/front_cover.png
    back_blurb: str = ""                 # LLM-generated back-cover description
    author_name: str = ""
    tagline: str = ""
    generated_at: Optional[str] = None  # ISO timestamp


class CoverGenerateRequest(BaseModel):
    """Optional overrides when triggering cover generation."""
    cover_style: Optional[str] = None    # override default style
    tagline: Optional[str] = None
    author_name: Optional[str] = None


class CoverUpdateRequest(BaseModel):
    """Body for PUT /api/projects/{id}/cover — manual metadata update."""
    cover_style: Optional[str] = None
    author_name: Optional[str] = None
    tagline: Optional[str] = None
    back_blurb: Optional[str] = None


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    title: str
    original_idea: str
    tone: str
    age_range: str
    page_count: int
    theme: str = ""
    hook: str = ""
    summary: str = ""
    outline: List[str] = []
    story_memory: Optional[dict] = None  # Story Consistency Engine data
    lore_universe_id: Optional[str] = None  # Linked LoreEngine universe
    # Lore Pool fields
    visibility: str = "private"  # private | shared_archetype | public_template | demo_only
    is_locked: bool = False
    origin_type: str = "user"  # user | demo | generated_from_pool
    shared_template_id: Optional[str] = None
    is_demo: bool = False
    # Publishing Center fields
    publishing_metadata: Optional[dict] = None   # BookMetadata dict
    book_format: Optional[dict] = None           # BookFormatSettings dict
    series_id: Optional[str] = None
    series_order: Optional[int] = None
    series_title: Optional[str] = None
    # Illustration system fields
    illustration_style: str = DEFAULT_STYLE_PRESET  # style preset key
    # Page Layout Engine fields
    page_theme: str = DEFAULT_PAGE_THEME  # cozy_bedtime | bright_storybook | watercolor_calm | comic_adventure
    # Smart Cover Generator fields
    cover: Optional[dict] = None  # CoverData dict
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProjectCreate(BaseModel):
    title: str = ""
    original_idea: str
    tone: str
    age_range: str
    page_count: int
    lore_universe_id: Optional[str] = None

class BlueprintRequest(BaseModel):
    original_idea: str
    tone: str
    age_range: str
    page_count: int
    lore_universe_id: Optional[str] = None

class BlueprintResponse(BaseModel):
    title: str
    hook: str
    summary: str
    theme: str
    characters: List[dict]
    outline: List[str]

class PageTextRequest(BaseModel):
    project_id: str
    page_number: int
    outline_beat: str

class IllustrationPromptRequest(BaseModel):
    project_id: str
    page_number: int
    page_text: str

class ImprovePageRequest(BaseModel):
    project_id: str
    page_id: str
    page_text: str
    modifier: str  # funnier, cozier, dialogue, simpler, emotional

class StoryMemoryUpdate(BaseModel):
    characters: Optional[List[dict]] = None
    relationships: Optional[List[dict]] = None
    settings: Optional[List[dict]] = None
    events: Optional[List[dict]] = None
    tone_notes: Optional[str] = None
    style_guide: Optional[str] = None

# ==================== NEW V1.3 MODELS ====================

class StoryPathRequest(BaseModel):
    original_idea: str
    tone: str
    age_range: str

class StoryPath(BaseModel):
    id: str
    title: str
    description: str
    theme: str

class StoryPathsResponse(BaseModel):
    paths: List[StoryPath]

class LegacyCharacter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    animal_or_type: str = ""  # e.g., "raccoon", "child", "robot"
    trait: str = ""
    favorite_thing: str = ""
    fear: str = ""
    appearance: str = ""
    backstory: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LegacyCharacterCreate(BaseModel):
    name: str
    animal_or_type: str = ""
    trait: str = ""
    favorite_thing: str = ""
    fear: str = ""
    appearance: str = ""
    backstory: str = ""

class BookFormat(BaseModel):
    format_type: str  # "picture_book", "early_reader", "chapter_book"
    page_count: int
    words_per_page: str  # e.g., "1-2 sentences", "3-5 sentences", "paragraph"
    chapter_count: Optional[int] = None

class LessonType(BaseModel):
    lesson: str  # kindness, teamwork, patience, honesty, courage, etc.

class StorytimeScript(BaseModel):
    page_number: int
    narrator_text: str
    narrator_direction: str  # e.g., "soft voice", "excited voice"
    character_lines: List[dict]  # [{character: "Milo", line: "Oh no!", direction: "nervous"}]
    pacing_cue: str  # e.g., "pause for effect", "speed up"

# ==================== LORE POOL MODELS ====================

# Allowed visibility values
VISIBILITY_OPTIONS = {"private", "shared_archetype", "public_template", "demo_only"}

# Allowed source apps (Rainstorms itself + SagaARCH cross-app)
SOURCE_APPS = {"rainstorms", "sagaarch"}

class LorePoolEntry(BaseModel):
    """Full shared_lore_pool document — matches the cross-app spec."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Provenance
    source_app: str = "rainstorms"          # rainstorms | sagaarch
    source_type: str                        # character | story_seed | faction | world_seed | book_concept | location | arc
    source_id: str
    owner_user_id: Optional[str] = None
    universe_id: Optional[str] = None
    # Visibility / safety
    visibility: str                         # shared_archetype | public_template | demo_only
    safety_level: str = "safe"             # safe | flagged | locked
    is_locked: bool = False
    is_demo: bool = False
    allow_derivatives: bool = True
    derivative_rules: Optional[dict] = Field(
        default_factory=lambda: {"rename_required": True, "exact_plot_reuse": False, "exact_visual_copy": False}
    )
    # Archetype / abstraction fields
    archetype_name: str = ""
    category: str = ""                      # hero | villain | mentor | world | faction | location | arc
    role_type: str = ""
    role_pattern: str = ""                  # generalised pattern (e.g. "reluctant mythic warrior")
    ideology_pattern: str = ""             # for factions (e.g. "conquest through order")
    conflict_pattern: str = ""             # internal / external conflict pattern
    location_pattern: str = ""             # for locations (e.g. "ruined fortress-city")
    tone: str = ""
    genre: str = ""
    age_band: str = ""
    visual_tags: List[str] = []
    theme_tags: List[str] = []
    abstraction_summary: str = ""          # human-readable safe summary
    summary_template: str = ""             # generation-facing pattern text
    # Moderation flags
    flag_suspected_copying: bool = False
    flag_locked_archetype: bool = False
    flag_admin_reviewed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class LorePoolShareRequest(BaseModel):
    source_type: str  # character | book_concept
    source_id: str
    visibility: str  # shared_archetype | public_template

class SharedLorePoolShareRequest(BaseModel):
    """Request body for POST /api/shared-lore-pool/share (full contract)."""
    source_app: str = "rainstorms"
    source_type: str
    source_id: str
    visibility: str
    universe_id: Optional[str] = None

class SharedLorePoolExtractRequest(BaseModel):
    """Request body for POST /api/shared-lore-pool/extract."""
    source_app: str = "rainstorms"
    source_type: str  # character | book_concept | faction | location | arc | world_seed
    source_id: str

class LorePoolGenerateRequest(BaseModel):
    filters: List[str] = []  # bedtime, funny, adventure, emotional, fantasy, sibling, animal_hero, magic
    tone: Optional[str] = None
    age_range: Optional[str] = None
    genre: Optional[str] = None
    story_type: Optional[str] = None
    page_count: int = 10
    count: int = 1  # number of story seeds to generate
    generation_mode: str = "story_seed"  # story_seed | full_blueprint | fresh_recombination

class SharedLorePoolGenerateRequest(BaseModel):
    """Request body for POST /api/shared-lore-pool/generate (full contract)."""
    filters: Optional[dict] = None   # {"tone": ..., "age_band": ..., "genre": ..., "theme_tags": [...], "category": ...}
    count: int = 1
    generation_mode: str = "fresh_recombination"  # fresh_recombination | story_seed | full_blueprint

class VisibilityUpdate(BaseModel):
    visibility: str

class LorePoolFlagRequest(BaseModel):
    flag_suspected_copying: Optional[bool] = None
    flag_locked_archetype: Optional[bool] = None
    flag_admin_reviewed: Optional[bool] = None

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except:
        return None

async def require_auth(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# ==================== AI GENERATION HELPERS ====================

async def generate_story_paths(idea: str, tone: str, age_range: str) -> List[dict]:
    """Generate 3 different story path options"""
    _system = """You are a children's book story developer.
Create engaging, distinct story directions for young readers.
Always respond with valid JSON only."""

    prompt = f"""Given this story idea, create 3 different story directions the user can choose from:

ORIGINAL IDEA: {idea}
TONE: {tone}
AGE RANGE: {age_range} years

Generate 3 distinct story paths. Each should take the idea in a different direction.

Return JSON array with exactly 3 paths:
[
    {{
        "id": "path_a",
        "title": "Short catchy title for this direction",
        "description": "2-3 sentences describing what this story would be about",
        "theme": "The main lesson or message"
    }},
    {{
        "id": "path_b",
        "title": "Different direction title",
        "description": "2-3 sentences for alternate story approach",
        "theme": "Different lesson or message"
    }},
    {{
        "id": "path_c",
        "title": "Third unique direction",
        "description": "2-3 sentences for third story approach",
        "theme": "Third lesson or message"
    }}
]

Make each path genuinely different:
- Path A: Focus on protecting/helping others
- Path B: Focus on the hero's personal growth/overcoming fears
- Path C: Focus on adventure/exploration/discovery

Return ONLY the JSON array, no other text."""

    response = await _llm_chat(_system, prompt)
    
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse story paths JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate story paths. Please try again.")

async def generate_storytime_script(page_text: str, characters: List[dict], page_number: int) -> dict:
    """Generate narrator script with voice directions for dramatic reading"""
    _system = """You are a children's storytelling coach.
Create engaging narrator scripts with voice directions for parents reading to children.
Always respond with valid JSON only."""

    char_names = [c['name'] for c in characters]
    
    prompt = f"""Create a dramatic reading script for this picture book page:

PAGE {page_number} TEXT:
{page_text}

CHARACTERS IN STORY: {', '.join(char_names)}

Generate a storytime script with narrator directions and character voice cues.

Return JSON:
{{
    "page_number": {page_number},
    "narrator_text": "The text the narrator reads (may be slightly modified for flow)",
    "narrator_direction": "Voice direction like 'soft and cozy', 'building excitement', 'whispered'",
    "character_lines": [
        {{"character": "Character Name", "line": "What they say", "direction": "How to say it"}}
    ],
    "pacing_cue": "Timing note like 'pause for effect', 'read slowly', 'quick and playful'"
}}

Make it engaging for bedtime reading. If there's no dialogue, character_lines can be empty.
Return ONLY the JSON, no other text."""

    response = await _llm_chat(_system, prompt)
    
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse storytime script JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate storytime script.")


def _normalize_lore_context(data: dict) -> dict:
    """
    Normalise a story-context payload from SagaArchitect into the internal field
    convention expected by generate_blueprint().

    SagaArchitect uses 'name' and 'tone' at the top level; generate_blueprint
    expects 'universe_name' and 'universe_tone'.  Both shapes are accepted.
    """
    ctx = dict(data)
    if "universe_name" not in ctx:
        ctx["universe_name"] = ctx.get("name", "")
    if "universe_tone" not in ctx:
        ctx["universe_tone"] = ctx.get("tone", "")
    return ctx

async def generate_blueprint(idea: str, tone: str, age_range: str, page_count: int, lesson: str = None, legacy_character: dict = None, lore_context: dict = None) -> dict:
    """Generate story blueprint using AI"""
    _system = """You are a children's book author and story development expert. 
You create engaging, age-appropriate stories for picture books.
Always respond with valid JSON only, no additional text."""

    # Build additional context
    extra_context = ""
    if lesson:
        extra_context += f"\nLESSON TO TEACH: {lesson} (weave this message naturally into the story)"
    if legacy_character:
        extra_context += f"""
MAIN CHARACTER (use this character):
- Name: {legacy_character.get('name', '')}
- Type: {legacy_character.get('animal_or_type', '')}
- Trait: {legacy_character.get('trait', '')}
- Favorite thing: {legacy_character.get('favorite_thing', '')}
- Fear: {legacy_character.get('fear', '')}
- Appearance: {legacy_character.get('appearance', '')}
"""
    if lore_context:
        lore_block = f"""
UNIVERSE LORE CONTEXT (story must be consistent with this canon):
UNIVERSE: {lore_context.get('universe_name', '')}
TONE: {lore_context.get('universe_tone', '')}
WORLD OVERVIEW: {lore_context.get('world_overview', '')}"""
        if lore_context.get('current_conflict'):
            lore_block += f"\nCURRENT CONFLICT: {lore_context['current_conflict']}"
        if lore_context.get('world_rules'):
            rules = "; ".join(
                r.get('rule', '') for r in lore_context['world_rules'] if r.get('rule')
            )
            lore_block += f"\nWORLD RULES: {rules}"
        if lore_context.get('relevant_factions'):
            factions = ", ".join(
                f"{f['name']} ({f.get('ideology', '')})"
                for f in lore_context['relevant_factions']
            )
            lore_block += f"\nFACTIONS: {factions}"
        if lore_context.get('relevant_characters'):
            chars = ", ".join(
                f"{c['name']} ({c.get('role', '')})"
                for c in lore_context['relevant_characters']
            )
            lore_block += f"\nKEY CHARACTERS: {chars}"
        if lore_context.get('relevant_locations'):
            locs = ", ".join(
                f"{l['name']} ({l.get('type', '')})"
                for l in lore_context['relevant_locations']
            )
            lore_block += f"\nLOCATIONS: {locs}"
        if lore_context.get('timeline_context'):
            timeline = "; ".join(
                f"{e.get('era', '')} — {e.get('title', '')}"
                for e in lore_context['timeline_context'][:5]
            )
            lore_block += f"\nTIMELINE: {timeline}"
        extra_context += lore_block

    prompt = f"""Create a children's book blueprint for this story idea:

IDEA: {idea}
TONE: {tone}
AGE RANGE: {age_range} years
PAGE COUNT: {page_count} pages
{extra_context}

Generate a complete blueprint in this exact JSON format:
{{
    "title": "Creative, engaging title",
    "hook": "One compelling sentence that captures the heart of the story",
    "summary": "2-3 sentences describing the full story arc",
    "theme": "The core message or lesson of the story",
    "characters": [
        {{
            "name": "Character name",
            "role": "main/supporting/minor",
            "personality": "2-3 key personality traits",
            "appearance": "Visual description for illustration",
            "special_trait": "Unique characteristic that makes them memorable"
        }}
    ],
    "outline": [
        "Page 1: Opening scene description and story beat",
        "Page 2: Next story beat",
        ...continue for all {page_count} pages
    ]
}}

Rules:
- Make the title catchy and memorable
- Keep language appropriate for {age_range} year olds
- Each outline beat should be 1-2 sentences describing what happens on that page
- Include 2-4 characters depending on the story
- Ensure the story has a clear beginning, middle, and satisfying ending
- Match the {tone} tone throughout
{f'- Naturally incorporate the lesson about {lesson}' if lesson else ''}
{f'- The main character must be {legacy_character.get("name", "")} with their established traits' if legacy_character else ''}
{f'- The story must respect the UNIVERSE LORE CONTEXT above — use real faction/character/location names where fitting, and do not contradict any world rules' if lore_context else ''}

Return ONLY the JSON, no other text."""

    response = await _llm_chat(_system, prompt)
    
    # Parse the JSON response
    try:
        # Clean the response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse blueprint JSON: {e}")
        logger.error(f"Response was: {response}")
        raise HTTPException(status_code=500, detail="Failed to generate blueprint. Please try again.")

async def generate_characters(blueprint: dict) -> List[dict]:
    """Generate detailed character cards"""
    _system = """You are a children's book character designer.
Create vivid, memorable characters with distinct visual appearances.
Always respond with valid JSON only."""

    prompt = f"""Based on this story blueprint, create detailed character cards:

TITLE: {blueprint.get('title', '')}
SUMMARY: {blueprint.get('summary', '')}
THEME: {blueprint.get('theme', '')}
EXISTING CHARACTERS: {json.dumps(blueprint.get('characters', []))}

Expand each character with rich details. Return JSON array:
[
    {{
        "name": "Character name",
        "role": "main/supporting/minor",
        "personality": "Detailed personality description (3-4 sentences)",
        "appearance": "Detailed visual description for illustrator (colors, clothing, features, expressions)",
        "special_trait": "What makes this character unique and memorable",
        "notes": "Additional notes for consistency in illustrations"
    }}
]

Make appearances specific enough for consistent illustration across all pages.
Return ONLY the JSON array, no other text."""

    response = await _llm_chat(_system, prompt)
    
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse characters JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate characters. Please try again.")

async def generate_page_text(project: dict, characters: List[dict], page_number: int, outline_beat: str) -> dict:
    """Generate text for a specific page"""
    _system = """You are a children's picture book author.
Write engaging, age-appropriate text for picture book pages.
Keep text concise - typically 2-5 sentences per page.
Always respond with valid JSON only."""

    character_info = "\n".join([f"- {c['name']}: {c['appearance']}" for c in characters])
    
    prompt = f"""Write the text for page {page_number} of this children's book:

TITLE: {project.get('title', '')}
SUMMARY: {project.get('summary', '')}
TONE: {project.get('tone', '')}
AGE RANGE: {project.get('age_range', '')}

CHARACTERS:
{character_info}

PAGE {page_number} OUTLINE BEAT: {outline_beat}

Write the actual picture book text for this page. Return JSON:
{{
    "page_text": "The actual text that would appear on this page of the book (2-5 sentences, vivid and age-appropriate)",
    "emotional_beat": "The emotional tone/feeling of this page (e.g., 'wonder', 'excitement', 'cozy comfort')"
}}

Rules:
- Keep sentences short and rhythmic
- Use vivid, sensory language children can understand
- Match the {project.get('tone', 'cozy')} tone
- Appropriate for {project.get('age_range', '3-8')} year olds
- Text should work well with an illustration

Return ONLY the JSON, no other text."""

    response = await _llm_chat(_system, prompt)
    
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse page text JSON: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate page text. Please try again.")

async def generate_illustration_prompt(project: dict, characters: List[dict], page_number: int, page_text: str) -> str:
    """
    Generate an illustration prompt for a page.

    Uses the Character Consistency Engine to:
    - Detect which characters appear in the page text
    - Inject their full visual profiles into the prompt
    - Prefer locked appearance data to ensure consistency
    """
    _system = """You are a children's book art director.
Create detailed illustration prompts that capture the essence of each page.
Focus on composition, mood, and character consistency.
When character visual profiles are provided, include those exact visual details in the prompt."""

    # Detect which characters appear in this page's text
    detected = _detect_characters_in_text(page_text, characters)
    # Fall back to all characters if none detected
    chars_for_prompt = detected if detected else characters

    # Build rich visual briefs using the Character Consistency Engine
    character_info_lines = []
    for c in chars_for_prompt:
        brief = _build_character_visual_brief(c)
        if brief:
            locked_note = " [LOCKED APPEARANCE]" if c.get("appearance_locked") else ""
            character_info_lines.append(f"- {brief}{locked_note}")
    character_info = "\n".join(character_info_lines) if character_info_lines else "(no specific characters)"

    prompt = f"""Create an illustration prompt for page {page_number}:

TITLE: {project.get('title', '')}
TONE: {project.get('tone', '')}
PAGE TEXT: {page_text}

CHARACTERS WITH VISUAL PROFILES (inject these exact descriptions):
{character_info}

Create a detailed illustration prompt. Include:
1. Scene description and setting
2. Characters present — use their exact visual descriptions above
3. Key visual elements and props
4. Mood and lighting
5. Composition suggestions

End with this style note:
"Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"

Return ONLY the illustration prompt text, nothing else."""

    response = await _llm_chat(_system, prompt)
    return response.strip()

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    
    # Create token
    token = create_token(user_id, user_data.email.lower())
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user_id, email=user_data.email.lower(), created_at=user["created_at"])
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """Login user"""
    user = await db.users.find_one({"email": user_data.email.lower()})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"], user["email"])
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user["id"], email=user["email"], created_at=user["created_at"])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user = Depends(require_auth)):
    """Get current user"""
    db_user = await db.users.find_one({"id": user["user_id"]})
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(id=db_user["id"], email=db_user["email"], created_at=db_user["created_at"])

# ==================== PROJECT ENDPOINTS ====================

@api_router.post("/projects", response_model=Project)
async def create_project(project_data: ProjectCreate, user = Depends(get_current_user)):
    """Create a new project"""
    project = Project(
        user_id=user["user_id"] if user else None,
        title=project_data.title,
        original_idea=project_data.original_idea,
        tone=project_data.tone,
        age_range=project_data.age_range,
        page_count=project_data.page_count
    )
    await db.projects.insert_one(project.dict())
    return project

@api_router.get("/projects", response_model=List[Project])
async def get_projects(user = Depends(require_auth)):
    """Get all projects for current user"""
    projects = await db.projects.find({"user_id": user["user_id"]}).to_list(100)
    return [Project(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, user = Depends(get_current_user)):
    """Get a specific project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project)

@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, updates: dict, user = Depends(get_current_user)):
    """Update a project"""
    updates["updated_at"] = datetime.utcnow()
    await db.projects.update_one({"id": project_id}, {"$set": updates})
    project = await db.projects.find_one({"id": project_id})
    return Project(**project)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user = Depends(require_auth)):
    """Delete a project and its related data"""
    await db.projects.delete_one({"id": project_id})
    await db.characters.delete_many({"project_id": project_id})
    await db.pages.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ==================== AI GENERATION ENDPOINTS ====================

@api_router.post("/generate/story-paths")
async def generate_story_paths_endpoint(request: StoryPathRequest):
    """Generate 3 story path options for user to choose from"""
    paths = await generate_story_paths(
        request.original_idea,
        request.tone,
        request.age_range
    )
    return {"paths": paths}

@api_router.post("/generate/blueprint", response_model=BlueprintResponse)
async def generate_story_blueprint(request: BlueprintRequest, lesson: str = None, legacy_character_id: str = None, user = Depends(get_current_user)):
    """Generate a story blueprint from an idea"""
    # Get legacy character if specified
    legacy_char = None
    if legacy_character_id and user:
        legacy_char_doc = await db.legacy_characters.find_one({"id": legacy_character_id, "user_id": user["user_id"]})
        if legacy_char_doc:
            legacy_char = legacy_char_doc

    # Fetch LoreEngine story context when a universe is linked
    lore_context = None
    if request.lore_universe_id:
        if not SAGA_ARCHITECT_BASE_URL:
            raise HTTPException(
                status_code=503,
                detail="SAGA_ARCHITECT_BASE_URL is not configured. Set it in the backend .env file."
            )
        story_context_url = f"{SAGA_ARCHITECT_BASE_URL}/api/universes/{request.lore_universe_id}/story-context"
        logger.info("Fetching story context from SagaArchitect: %s", story_context_url)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client_http:
                resp = await client_http.get(story_context_url)
            if resp.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Universe '{request.lore_universe_id}' not found in SagaArchitect."
                )
            if resp.status_code != 200:
                logger.error("SagaArchitect story-context returned %s: %s", resp.status_code, resp.text)
                raise HTTPException(
                    status_code=502,
                    detail=f"SagaArchitect returned an unexpected status ({resp.status_code}). Cannot fetch story context."
                )
            try:
                raw_context = resp.json()
            except Exception as parse_exc:
                logger.error("SagaArchitect story-context response is not valid JSON: %s", parse_exc)
                raise HTTPException(
                    status_code=502,
                    detail="SagaArchitect returned a non-JSON response. Cannot parse story context."
                )
            lore_context = _normalize_lore_context(raw_context)
            logger.info(
                "Story context loaded for universe '%s' (%s characters, %s factions, %s world rules)",
                lore_context.get("universe_name", request.lore_universe_id),
                len(lore_context.get("relevant_characters", [])),
                len(lore_context.get("relevant_factions", [])),
                len(lore_context.get("world_rules", [])),
            )
        except httpx.RequestError as exc:
            logger.error("Failed to reach SagaArchitect at %s: %s", story_context_url, exc)
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach SagaArchitect ({SAGA_ARCHITECT_BASE_URL}). Check SAGA_ARCHITECT_BASE_URL and ensure the service is running."
            )

    try:
        blueprint = await generate_blueprint(
            request.original_idea,
            request.tone,
            request.age_range,
            request.page_count,
            lesson=lesson,
            legacy_character=legacy_char,
            lore_context=lore_context,
        )
        return BlueprintResponse(**blueprint)
    except RuntimeError as e:
        if "API_KEY" in str(e) or "not configured" in str(e).lower():
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "LLM not configured",
                    "hint": "Set LLM_PROVIDER=groq and GROQ_API_KEY in Railway Variables. Get a free key at https://console.groq.com",
                    "original": str(e),
                },
            )
        raise
    except Exception as e:
        logger.exception("Blueprint generation failed")
        err_str = str(e).lower()
        if "429" in err_str or "quota" in err_str or "exceeded" in err_str:
            hint = "Groq free tier quota exceeded. Try again later or add a new API key at console.groq.com."
        elif "connection" in err_str or "connect" in err_str:
            hint = "Cannot reach AI provider. Check GROQ_API_KEY and LLM_PROVIDER=groq in Railway Variables."
        else:
            hint = "Check GROQ_API_KEY is valid and LLM_PROVIDER=groq in Railway Variables."
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI generation failed",
                "hint": hint,
                "original": str(e)[:200],
            },
        )

@api_router.post("/generate/characters")
async def generate_story_characters(project_id: str):
    """Generate characters for a project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    blueprint = {
        "title": project["title"],
        "summary": project["summary"],
        "theme": project["theme"]
    }
    
    # Get existing characters if any
    existing_chars = await db.characters.find({"project_id": project_id}).to_list(20)
    if existing_chars:
        blueprint["characters"] = [{"name": c["name"], "role": c["role"]} for c in existing_chars]
    
    characters_data = await generate_characters(blueprint)
    
    # Delete existing characters and create new ones
    await db.characters.delete_many({"project_id": project_id})
    
    characters = []
    for char_data in characters_data:
        char = Character(
            project_id=project_id,
            name=char_data["name"],
            role=char_data["role"],
            personality=char_data["personality"],
            appearance=char_data["appearance"],
            special_trait=char_data["special_trait"],
            notes=char_data.get("notes", "")
        )
        await db.characters.insert_one(char.dict())
        characters.append(char)
    
    return characters

@api_router.post("/generate/page-text")
async def generate_page_text_endpoint(request: PageTextRequest):
    """Generate text for a specific page"""
    project = await db.projects.find_one({"id": request.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    characters = await db.characters.find({"project_id": request.project_id}).to_list(20)
    # Provide name + appearance for text generation (consistent with prior behaviour)
    char_list = [{"name": c["name"], "appearance": c.get("appearance", "")} for c in characters]

    result = await generate_page_text(project, char_list, request.page_number, request.outline_beat)

    # Update the page in database
    await db.pages.update_one(
        {"project_id": request.project_id, "page_number": request.page_number},
        {"$set": {
            "page_text": result["page_text"],
            "emotional_beat": result["emotional_beat"],
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )

    return result

@api_router.post("/generate/illustration-prompt")
async def generate_illustration_prompt_endpoint(request: IllustrationPromptRequest):
    """Generate illustration prompt for a page using the Character Consistency Engine"""
    project = await db.projects.find_one({"id": request.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Pass full character documents so _detect_characters_in_text and
    # _build_character_visual_brief can use all visual profile fields
    characters = await db.characters.find({"project_id": request.project_id}).to_list(20)

    prompt = await generate_illustration_prompt(project, characters, request.page_number, request.page_text)

    # Update the page in database
    await db.pages.update_one(
        {"project_id": request.project_id, "page_number": request.page_number},
        {"$set": {
            "illustration_prompt": prompt,
            "updated_at": datetime.utcnow()
        }}
    )

    return {"illustration_prompt": prompt}

@api_router.post("/generate/title")
async def regenerate_title(project_id: str):
    """Regenerate just the title"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompt = f"""Generate a new creative title for this children's book:
STORY IDEA: {project['original_idea']}
SUMMARY: {project.get('summary', '')}
TONE: {project['tone']}

Return ONLY the title text, nothing else."""
    
    response = await _llm_chat("You are a creative children's book title generator.", prompt)
    new_title = response.strip().strip('"').strip("'")
    
    await db.projects.update_one({"id": project_id}, {"$set": {"title": new_title, "updated_at": datetime.utcnow()}})
    
    return {"title": new_title}

@api_router.post("/generate/improve-page")
async def improve_page(request: ImprovePageRequest):
    """Improve page text with a specific modifier"""
    project = await db.projects.find_one({"id": request.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get story memory for consistency
    story_memory = project.get('story_memory', {})
    memory_context = ""
    if story_memory:
        if story_memory.get('characters'):
            memory_context += f"Characters: {json.dumps(story_memory['characters'])}\n"
        if story_memory.get('tone_notes'):
            memory_context += f"Tone notes: {story_memory['tone_notes']}\n"
        if story_memory.get('style_guide'):
            memory_context += f"Style guide: {story_memory['style_guide']}\n"
    
    modifier_instructions = {
        "funnier": "Make this text funnier with playful language, fun sound words, and light humor appropriate for children. Add moments that will make kids giggle.",
        "cozier": "Make this text cozier and warmer. Add sensory details about comfort - soft textures, warm feelings, safe spaces. Create a bedtime-friendly feeling.",
        "dialogue": "Add natural dialogue between characters. Show their personalities through how they speak. Keep dialogue simple and expressive for young readers.",
        "simpler": "Simplify the language for younger readers. Use shorter sentences, simpler words, and clearer descriptions. Keep it engaging but easier to understand.",
        "emotional": "Add more emotional depth. Show how characters feel through their actions and descriptions. Make moments more touching and heartfelt."
    }
    
    instruction = modifier_instructions.get(request.modifier, "Improve this text while maintaining the story's tone.")
    
    prompt = f"""Improve this children's book page text:

ORIGINAL TEXT:
{request.page_text}

STORY CONTEXT:
Title: {project['title']}
Tone: {project['tone']}
Age range: {project['age_range']}

INSTRUCTION: {instruction}

Return ONLY the improved text, nothing else. Keep it brief (2-5 sentences) as this is for a picture book page."""

    response = await _llm_chat(
        f"""You are a children's picture book editor. You help writers refine their text.
Keep text concise - picture books have brief text per page.
{memory_context}""",
        prompt,
    )
    improved_text = response.strip()
    
    # Update the page
    await db.pages.update_one(
        {"id": request.page_id},
        {"$set": {"page_text": improved_text, "updated_at": datetime.utcnow()}}
    )
    
    return {"page_text": improved_text}

# ==================== STORY MEMORY ENDPOINTS ====================

@api_router.get("/projects/{project_id}/story-memory")
async def get_story_memory(project_id: str):
    """Get story memory for a project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.get('story_memory', {
        "characters": [],
        "relationships": [],
        "settings": [],
        "events": [],
        "tone_notes": "",
        "style_guide": ""
    })

@api_router.put("/projects/{project_id}/story-memory")
async def update_story_memory(project_id: str, memory: StoryMemoryUpdate):
    """Update story memory for a project"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    current_memory = project.get('story_memory', {})
    updates = memory.dict(exclude_none=True)
    current_memory.update(updates)
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"story_memory": current_memory, "updated_at": datetime.utcnow()}}
    )
    
    return current_memory

@api_router.post("/projects/{project_id}/story-memory/generate")
async def generate_story_memory(project_id: str):
    """Auto-generate story memory from existing project data"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    
    # Build character summaries for memory
    char_summaries = []
    for char in characters:
        summary = {
            "name": char['name'],
            "role": char['role'],
            "key_traits": char.get('personality', '')[:100],
            "visual_key": char.get('appearance', '')[:80]
        }
        if char.get('visual_tags'):
            summary["visual_tags"] = char['visual_tags']
        char_summaries.append(summary)
    
    # Extract settings from pages
    settings = []
    if project.get('summary'):
        settings.append({"name": "Main Setting", "description": "From story summary"})
    
    # Build story memory
    story_memory = {
        "characters": char_summaries,
        "relationships": [],
        "settings": settings,
        "events": [],
        "tone_notes": f"Story tone: {project['tone']}. Age range: {project['age_range']}.",
        "style_guide": f"Picture book for ages {project['age_range']}. Keep language simple and vivid. Theme: {project.get('theme', '')}"
    }
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"story_memory": story_memory, "updated_at": datetime.utcnow()}}
    )
    
    return story_memory

# ==================== CHARACTER ENDPOINTS ====================

@api_router.get("/projects/{project_id}/characters", response_model=List[Character])
async def get_characters(project_id: str):
    """Get all characters for a project"""
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    return [Character(**c) for c in characters]

@api_router.post("/projects/{project_id}/characters", response_model=Character)
async def create_character(project_id: str, char_data: CharacterCreate):
    """Create a new character"""
    char = Character(
        project_id=project_id,
        name=char_data.name,
        role=char_data.role,
        personality=char_data.personality,
        appearance=char_data.appearance,
        special_trait=char_data.special_trait,
        notes=char_data.notes,
        color_palette=char_data.color_palette,
        clothing=char_data.clothing,
        unique_traits=char_data.unique_traits,
        visual_tags=char_data.visual_tags,
    )
    await db.characters.insert_one(char.dict())
    return char

@api_router.put("/characters/{character_id}", response_model=Character)
async def update_character(character_id: str, updates: dict):
    """Update a character"""
    await db.characters.update_one({"id": character_id}, {"$set": updates})
    char = await db.characters.find_one({"id": character_id})
    return Character(**char)

@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str):
    """Delete a character"""
    await db.characters.delete_one({"id": character_id})
    return {"message": "Character deleted"}

# ==================== PAGE ENDPOINTS ====================

@api_router.get("/projects/{project_id}/pages", response_model=List[PageData])
async def get_pages(project_id: str):
    """Get all pages for a project"""
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    return [PageData(**p) for p in pages]

@api_router.post("/projects/{project_id}/pages", response_model=PageData)
async def create_page(project_id: str, page_data: PageCreate):
    """Create a new page"""
    page = PageData(
        project_id=project_id,
        page_number=page_data.page_number,
        outline_beat=page_data.outline_beat,
        page_text=page_data.page_text,
        illustration_prompt=page_data.illustration_prompt,
        emotional_beat=page_data.emotional_beat
    )
    await db.pages.insert_one(page.dict())
    return page

@api_router.put("/pages/{page_id}", response_model=PageData)
async def update_page(page_id: str, updates: dict):
    """Update a page"""
    updates["updated_at"] = datetime.utcnow()
    await db.pages.update_one({"id": page_id}, {"$set": updates})
    page = await db.pages.find_one({"id": page_id})
    return PageData(**page)

@api_router.post("/projects/{project_id}/pages/bulk")
async def bulk_create_pages(project_id: str, pages_data: List[PageCreate]):
    """Create multiple pages at once (for outline)"""
    # Delete existing pages
    await db.pages.delete_many({"project_id": project_id})
    
    pages = []
    for page_data in pages_data:
        page = PageData(
            project_id=project_id,
            page_number=page_data.page_number,
            outline_beat=page_data.outline_beat,
            page_text=page_data.page_text,
            illustration_prompt=page_data.illustration_prompt,
            emotional_beat=page_data.emotional_beat
        )
        await db.pages.insert_one(page.dict())
        pages.append(page)
    
    return pages

# ==================== EXPORT ENDPOINTS ====================

@api_router.get("/projects/{project_id}/export/story-pdf")
async def export_story_pdf(project_id: str):
    """Export story as PDF - polished children's book manuscript format"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        topMargin=1.2*inch, 
        bottomMargin=1*inch,
        leftMargin=1.25*inch,
        rightMargin=1.25*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Title page styles
    main_title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Title'],
        fontSize=36,
        spaceAfter=20,
        textColor=HexColor('#1E293B'),
        alignment=1,
        leading=44
    )
    hook_style = ParagraphStyle(
        'Hook',
        parent=styles['Normal'],
        fontSize=16,
        spaceAfter=30,
        textColor=HexColor('#6366F1'),
        alignment=1,
        fontName='Helvetica-Oblique',
        leading=24
    )
    meta_style = ParagraphStyle(
        'Meta',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=8,
        textColor=HexColor('#64748B'),
        alignment=1
    )
    
    # Content styles
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=20,
        spaceBefore=10,
        textColor=HexColor('#1E293B'),
        alignment=1
    )
    summary_style = ParagraphStyle(
        'Summary',
        parent=styles['Normal'],
        fontSize=13,
        spaceAfter=16,
        textColor=HexColor('#374151'),
        leading=22,
        alignment=4  # Justified
    )
    theme_style = ParagraphStyle(
        'Theme',
        parent=styles['Normal'],
        fontSize=13,
        spaceAfter=12,
        textColor=HexColor('#6366F1'),
        fontName='Helvetica-Oblique',
        alignment=1
    )
    page_number_style = ParagraphStyle(
        'PageNumber',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=8,
        textColor=HexColor('#6366F1'),
        fontName='Helvetica-Bold'
    )
    page_text_style = ParagraphStyle(
        'PageText',
        parent=styles['Normal'],
        fontSize=15,
        spaceAfter=12,
        leading=26,
        textColor=HexColor('#1E293B'),
        alignment=4  # Justified
    )
    emotional_beat_style = ParagraphStyle(
        'EmotionalBeat',
        parent=styles['Normal'],
        fontSize=11,
        textColor=HexColor('#94A3B8'),
        fontName='Helvetica-Oblique'
    )
    char_style = ParagraphStyle(
        'Character',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=10,
        textColor=HexColor('#475569'),
        leading=16
    )
    
    story = []
    
    # ========== TITLE PAGE ==========
    story.append(Spacer(1, 1.8*inch))
    story.append(Paragraph(project['title'], main_title_style))
    story.append(Spacer(1, 0.4*inch))
    if project.get('hook'):
        story.append(Paragraph(f'"{project["hook"]}"', hook_style))
    story.append(Spacer(1, 1.2*inch))
    story.append(Paragraph(f"A children's picture book", meta_style))
    story.append(Paragraph(f"For ages {project['age_range']}", meta_style))
    story.append(Paragraph(f"{project['page_count']} pages • {project['tone']}", meta_style))
    story.append(Spacer(1, 0.8*inch))
    story.append(Paragraph("Created with Rainstorms", meta_style))
    story.append(PageBreak())
    
    # ========== SUMMARY PAGE ==========
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Story Summary", section_title_style))
    story.append(Spacer(1, 0.3*inch))
    if project.get('summary'):
        story.append(Paragraph(project['summary'], summary_style))
    story.append(Spacer(1, 0.4*inch))
    if project.get('theme'):
        story.append(Paragraph(f"Theme: {project['theme']}", theme_style))
    story.append(PageBreak())
    
    # ========== CHARACTER REFERENCE ==========
    if characters:
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Character Reference", section_title_style))
        story.append(Spacer(1, 0.3*inch))
        for char in characters:
            char_text = f"<b>{char['name']}</b> ({char['role']})<br/>"
            char_text += f"<i>Appearance:</i> {char['appearance']}<br/>"
            if char.get('special_trait'):
                char_text += f"<i>Special trait:</i> {char['special_trait']}"
            story.append(Paragraph(char_text, char_style))
            story.append(Spacer(1, 0.15*inch))
        story.append(PageBreak())
    
    # ========== STORY PAGES ==========
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Story Manuscript", section_title_style))
    story.append(Spacer(1, 0.4*inch))
    
    for page in pages:
        story.append(Paragraph(f"— Page {page['page_number']} —", page_number_style))
        if page.get('page_text'):
            story.append(Paragraph(page['page_text'], page_text_style))
        if page.get('emotional_beat'):
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph(f"[{page['emotional_beat']}]", emotional_beat_style))
        story.append(Spacer(1, 0.45*inch))
    
    # ========== END PAGE ==========
    story.append(PageBreak())
    story.append(Spacer(1, 2.5*inch))
    story.append(Paragraph("~ The End ~", section_title_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph(f"Thank you for reading {project['title']}", meta_style))
    
    doc.build(story)
    buffer.seek(0)
    
    # Clean filename
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '' for c in project['title'])
    safe_title = safe_title.replace(' ', '_')
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_story.pdf"}
    )

@api_router.get("/projects/{project_id}/export/prompts-pdf")
async def export_prompts_pdf(project_id: str):
    """Export illustration prompts as PDF - art director reference sheet"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        topMargin=0.8*inch, 
        bottomMargin=0.7*inch,
        leftMargin=1*inch,
        rightMargin=1*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Styles
    main_title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Title'],
        fontSize=24,
        spaceAfter=8,
        textColor=HexColor('#1E293B'),
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=20,
        textColor=HexColor('#64748B'),
        alignment=1
    )
    section_header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=16,
        spaceAfter=12,
        spaceBefore=16,
        textColor=HexColor('#6366F1'),
        borderPadding=5
    )
    char_name_style = ParagraphStyle(
        'CharName',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=4,
        textColor=HexColor('#1E293B'),
        fontName='Helvetica-Bold'
    )
    char_detail_style = ParagraphStyle(
        'CharDetail',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=12,
        textColor=HexColor('#475569'),
        leading=15,
        leftIndent=10
    )
    page_header_style = ParagraphStyle(
        'PageHeader',
        parent=styles['Heading3'],
        fontSize=13,
        spaceAfter=8,
        spaceBefore=12,
        textColor=HexColor('#6366F1'),
        fontName='Helvetica-Bold'
    )
    text_label_style = ParagraphStyle(
        'TextLabel',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor('#94A3B8'),
        fontName='Helvetica-Bold'
    )
    page_text_style = ParagraphStyle(
        'PageText',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=10,
        textColor=HexColor('#374151'),
        leading=17
    )
    prompt_style = ParagraphStyle(
        'Prompt',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=16,
        textColor=HexColor('#1E293B'),
        leading=15,
        leftIndent=15,
        rightIndent=15,
        backColor=HexColor('#F8FAFC'),
        borderPadding=10
    )
    
    story = []
    
    # ========== TITLE ==========
    story.append(Paragraph(project['title'], main_title_style))
    story.append(Paragraph("Illustration Prompts & Art Direction", subtitle_style))
    story.append(Spacer(1, 0.2*inch))
    
    # ========== CHARACTER REFERENCE ==========
    story.append(Paragraph("Character Visual Reference", section_header_style))
    story.append(Spacer(1, 0.1*inch))
    
    for char in characters:
        story.append(Paragraph(f"{char['name']} ({char['role']})", char_name_style))
        detail_text = f"<b>Appearance:</b> {char['appearance']}"
        if char.get('special_trait'):
            detail_text += f"<br/><b>Special Trait:</b> {char['special_trait']}"
        if char.get('notes'):
            detail_text += f"<br/><b>Art Notes:</b> {char['notes']}"
        story.append(Paragraph(detail_text, char_detail_style))
    
    story.append(PageBreak())
    
    # ========== PAGE PROMPTS ==========
    story.append(Paragraph("Page-by-Page Illustration Prompts", section_header_style))
    story.append(Spacer(1, 0.15*inch))
    
    for page in pages:
        story.append(Paragraph(f"Page {page['page_number']}", page_header_style))
        
        if page.get('page_text'):
            story.append(Paragraph("STORY TEXT:", text_label_style))
            story.append(Paragraph(page['page_text'], page_text_style))
        
        if page.get('illustration_prompt'):
            story.append(Paragraph("ILLUSTRATION PROMPT:", text_label_style))
            story.append(Paragraph(page['illustration_prompt'], prompt_style))
        elif page.get('page_text'):
            story.append(Paragraph("ILLUSTRATION PROMPT:", text_label_style))
            story.append(Paragraph("[Not yet generated]", prompt_style))
        
        story.append(Spacer(1, 0.15*inch))
    
    doc.build(story)
    buffer.seek(0)
    
    # Clean filename
    safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '' for c in project['title'])
    safe_title = safe_title.replace(' ', '_')
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_illustration_prompts.pdf"}
    )

@api_router.get("/projects/{project_id}/export/text")
async def export_full_text(project_id: str):
    """Export full book text"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    
    text = f"{project['title']}\n\n"
    text += f"Hook: {project.get('hook', '')}\n\n"
    text += f"Summary: {project.get('summary', '')}\n\n"
    text += f"Theme: {project.get('theme', '')}\n\n"
    text += "=" * 50 + "\n\n"
    
    for page in pages:
        text += f"PAGE {page['page_number']}\n"
        text += f"{page.get('page_text', '')}\n\n"
    
    return {"text": text}

@api_router.get("/projects/{project_id}/export/json")
async def export_project_json(project_id: str):
    """Export complete project as JSON"""
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(50)
    
    # Remove MongoDB _id field and convert datetime objects to strings
    if '_id' in project:
        del project['_id']
    project['created_at'] = project['created_at'].isoformat() if project.get('created_at') else None
    project['updated_at'] = project['updated_at'].isoformat() if project.get('updated_at') else None
    
    for char in characters:
        if '_id' in char:
            del char['_id']
        char['created_at'] = char['created_at'].isoformat() if char.get('created_at') else None
    
    for page in pages:
        if '_id' in page:
            del page['_id']
        page['created_at'] = page['created_at'].isoformat() if page.get('created_at') else None
        page['updated_at'] = page['updated_at'].isoformat() if page.get('updated_at') else None
    
    return {
        "project": project,
        "characters": characters,
        "pages": pages
    }

# ==================== PUBLISHING CENTER ====================

def _get_trim_dimensions(trim_size: str):
    """Return (width_pts, height_pts) for the given trim size string."""
    from reportlab.lib.units import inch as _inch
    w, h = _TRIM_SIZES.get(trim_size, (8.0, 8.0))
    return w * _inch, h * _inch


def _publishing_checklist(project: dict, fmt: dict, issues: List[dict]) -> str:
    """Generate a human-readable publishing checklist text file."""
    title = project.get("title", "Untitled")
    page_count = project.get("page_count", 0)
    trim_size = fmt.get("trim_size", "8x8")
    bleed = fmt.get("bleed_enabled", True)
    paper = fmt.get("paper_type", "standard")
    cover_finish = fmt.get("cover_finish", "matte")
    color = fmt.get("interior_color", "color")

    warnings = [i for i in issues if i.get("level") == "warning"]
    errors = [i for i in issues if i.get("level") == "error"]

    lines = [
        "=" * 60,
        "RAINSTORMS PUBLISHING CHECKLIST",
        "=" * 60,
        f"Title:         {title}",
        f"Trim Size:     {trim_size} inches",
        f"Page Count:    {page_count}",
        f"Paper Type:    {paper}",
        f"Cover Finish:  {cover_finish}",
        f"Interior:      {color}",
        f"Bleed:         {'enabled' if bleed else 'disabled'}",
        "",
        "VALIDATION RESULTS",
        "-" * 60,
    ]
    if not errors and not warnings:
        lines.append("✓ All checks passed — ready to export!")
    else:
        for e in errors:
            lines.append(f"✗ ERROR:   {e.get('message', '')}")
        for w in warnings:
            lines.append(f"⚠ WARNING: {w.get('message', '')}")
    lines += [
        "",
        "PLATFORM COMPATIBILITY",
        "-" * 60,
        "Amazon KDP:    Supported trim sizes: 8x10, 8.5x11",
        "IngramSpark:   Supported trim sizes: 8x8, 8.5x8.5, 10x8",
        "Lulu:          Supported trim sizes: 8x8, 8.5x11, 10x8",
        "",
        "FILES IN THIS PACKAGE",
        "-" * 60,
        "interior.pdf   — print-ready interior with story text",
        "cover.pdf      — front/spine/back cover template",
        "ebook.epub     — EPUB 3.0 for Kindle, Apple Books, Kobo",
        "cover_preview.jpg  — cover thumbnail (placeholder)",
        "metadata.json  — publishing metadata",
        "publishing_checklist.txt  — this file",
        "",
        "Generated by Rainstorms Publishing Center",
        "https://rainstorms.app",
        "=" * 60,
    ]
    return "\n".join(lines)


def _validate_project_for_print(project: dict, pages: List[dict], fmt: dict) -> List[dict]:
    """
    Run print validation checks and return a list of issue dicts.
    Each issue has: level (warning|error), code, message.
    """
    issues: List[dict] = []
    page_count = project.get("page_count", 0)
    trim_size = fmt.get("trim_size", "8x8")
    bleed = fmt.get("bleed_enabled", True)

    # Check page count
    if page_count < 4:
        issues.append({
            "level": "error",
            "code": "page_count_too_low",
            "message": f"Page count ({page_count}) is too low. Minimum recommended is 24 pages.",
        })
    elif page_count < 24:
        issues.append({
            "level": "warning",
            "code": "page_count_low",
            "message": f"Page count ({page_count}) is below the recommended minimum of 24 pages for print.",
        })

    # Check pages with text
    pages_missing_text = [p["page_number"] for p in pages if not p.get("page_text", "").strip()]
    if pages_missing_text:
        issues.append({
            "level": "warning",
            "code": "missing_page_text",
            "message": f"Pages {pages_missing_text} are missing story text.",
        })

    # Check text length per page (children's books: ≤80 words recommended)
    for page in pages:
        text = page.get("page_text", "")
        word_count = len(text.split())
        if word_count > 80:
            issues.append({
                "level": "warning",
                "code": "page_text_too_long",
                "message": f"Page {page['page_number']} has {word_count} words (max 80 recommended for children's books).",
            })

    # Check bleed setting
    if not bleed:
        issues.append({
            "level": "warning",
            "code": "no_bleed",
            "message": "Bleed is disabled. Most print platforms require 0.125\" bleed on all sides.",
        })

    # Check trim size compatibility
    trim_w, trim_h = _TRIM_SIZES.get(trim_size, (8.0, 8.0))
    if trim_w < 6.0 or trim_h < 6.0:
        issues.append({
            "level": "warning",
            "code": "trim_size_small",
            "message": f"Trim size {trim_size}\" may be too small. Minimum recommended is 6×6\".",
        })

    # Check illustration prompts
    pages_missing_prompts = [p["page_number"] for p in pages if not p.get("illustration_prompt", "").strip()]
    if pages_missing_prompts:
        issues.append({
            "level": "warning",
            "code": "missing_illustration_prompts",
            "message": f"Pages {pages_missing_prompts} are missing illustration prompts.",
        })

    return issues


def _build_interior_pdf(project: dict, pages: List[dict], fmt: dict) -> BytesIO:
    """
    Generate a print-ready interior PDF for the given project and pages.
    Optimised for children's books: large readable text, illustration placeholder areas.
    """
    from reportlab.lib.pagesizes import letter as _letter
    from reportlab.lib.units import inch as _inch
    from reportlab.lib.styles import getSampleStyleSheet as _get_styles, ParagraphStyle as _PS
    from reportlab.platypus import SimpleDocTemplate as _Doc, Paragraph as _P, Spacer as _Sp, PageBreak as _PB
    from reportlab.lib.colors import HexColor as _Hex
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

    trim_w, trim_h = _get_trim_dimensions(fmt.get("trim_size", "8x8"))
    bleed = 0.125 * _inch if fmt.get("bleed_enabled", True) else 0.0
    # Standard safe margins: 0.5" inner margin, 0.375" outer
    margin = 0.5 * _inch
    safe_margin = margin + bleed

    buf = BytesIO()
    doc = _Doc(
        buf,
        pagesize=(trim_w, trim_h),
        topMargin=safe_margin,
        bottomMargin=safe_margin,
        leftMargin=safe_margin,
        rightMargin=safe_margin,
        title=project.get("title", ""),
        author=project.get("publishing_metadata", {}).get("author_name", "") if project.get("publishing_metadata") else "",
    )

    base_styles = _get_styles()

    title_style = _PS("BookTitle", parent=base_styles["Title"],
                       fontSize=28, textColor=_Hex("#1E293B"), alignment=TA_CENTER,
                       spaceAfter=16, leading=36)
    subtitle_style = _PS("BookSubtitle", parent=base_styles["Normal"],
                          fontSize=16, textColor=_Hex("#6366F1"), alignment=TA_CENTER,
                          fontName="Helvetica-Oblique", spaceAfter=12, leading=22)
    meta_style = _PS("BookMeta", parent=base_styles["Normal"],
                      fontSize=11, textColor=_Hex("#64748B"), alignment=TA_CENTER,
                      spaceAfter=8)
    page_num_style = _PS("PageNum", parent=base_styles["Normal"],
                          fontSize=13, textColor=_Hex("#6366F1"), fontName="Helvetica-Bold",
                          spaceAfter=6)
    page_text_style = _PS("PageText", parent=base_styles["Normal"],
                           fontSize=18, textColor=_Hex("#1E293B"), leading=28,
                           spaceAfter=12, alignment=TA_CENTER)
    illus_note_style = _PS("IllusNote", parent=base_styles["Normal"],
                            fontSize=10, textColor=_Hex("#94A3B8"),
                            fontName="Helvetica-Oblique", spaceAfter=4)
    section_style = _PS("Section", parent=base_styles["Heading2"],
                         fontSize=18, textColor=_Hex("#1E293B"), alignment=TA_CENTER,
                         spaceAfter=12, leading=24)

    meta = project.get("publishing_metadata") or {}
    story = []

    # ── Title page ──
    story.append(_Sp(1, 1.2 * _inch))
    story.append(_P(project.get("title", "Untitled"), title_style))
    if project.get("hook"):
        story.append(_P(project["hook"], subtitle_style))
    author = meta.get("author_name") or meta.get("pen_name") or ""
    if author:
        story.append(_P(f"by {author}", meta_style))
    age_range = meta.get("age_range") or project.get("age_range", "")
    if age_range:
        story.append(_P(f"Ages {age_range}", meta_style))
    story.append(_PB())

    # ── Copyright page ──
    copyright_holder = meta.get("copyright_holder") or author or project.get("user_id", "Author")
    pub_year = (meta.get("publication_date") or "")[:4] or str(datetime.utcnow().year)
    story.append(_Sp(1, 0.5 * _inch))
    story.append(_P(f"© {pub_year} {copyright_holder}", meta_style))
    if meta.get("publisher_name"):
        story.append(_P(meta["publisher_name"], meta_style))
    if meta.get("isbn_status") and meta["isbn_status"] != "none":
        story.append(_P(f"ISBN status: {meta['isbn_status']}", meta_style))
    story.append(_P("All rights reserved. No part of this book may be reproduced without permission.", meta_style))
    story.append(_PB())

    # ── Story pages ──
    sorted_pages = sorted(pages, key=lambda p: p.get("page_number", 0))
    for page in sorted_pages:
        pnum = page.get("page_number", "")
        text = page.get("page_text", "").strip()
        prompt = page.get("illustration_prompt", "").strip()

        story.append(_P(f"Page {pnum}", page_num_style))

        # Illustration placeholder (professional note for the printer/designer)
        if prompt:
            story.append(_P(f"[ILLUSTRATION: {prompt[:120]}{'...' if len(prompt) > 120 else ''}]",
                            illus_note_style))
        else:
            story.append(_P("[ILLUSTRATION PLACEHOLDER]", illus_note_style))

        if text:
            story.append(_P(text, page_text_style))
        else:
            story.append(_P("(No text for this page)", meta_style))

        story.append(_Sp(1, 0.25 * _inch))
        story.append(_PB())

    doc.build(story)
    buf.seek(0)
    return buf


def _build_cover_pdf(project: dict, fmt: dict) -> BytesIO:
    """
    Generate a cover PDF template: front cover + spine + back cover.
    Spine width is calculated from page count × paper thickness.
    """
    from reportlab.lib.units import inch as _inch
    from reportlab.lib.styles import getSampleStyleSheet as _get_styles, ParagraphStyle as _PS
    from reportlab.platypus import SimpleDocTemplate as _Doc, Paragraph as _P, Spacer as _Sp
    from reportlab.lib.colors import HexColor as _Hex, white as _white, black as _black
    from reportlab.lib.enums import TA_CENTER
    from reportlab.pdfgen import canvas as _canvas_mod

    trim_w, trim_h = _get_trim_dimensions(fmt.get("trim_size", "8x8"))
    bleed = 0.125 * _inch if fmt.get("bleed_enabled", True) else 0.0
    page_count = project.get("page_count", 32)
    spine_w = page_count * _PAPER_THICKNESS_INCHES * _inch
    # Total cover width = back + spine + front (with bleed on all outer edges)
    total_w = (trim_w * 2) + spine_w + (bleed * 4)
    total_h = trim_h + (bleed * 2)

    meta = project.get("publishing_metadata") or {}
    title = project.get("title", "Untitled")
    author = meta.get("author_name") or meta.get("pen_name") or ""
    description = meta.get("book_description") or project.get("summary", "")

    buf = BytesIO()
    c = _canvas_mod.Canvas(buf, pagesize=(total_w, total_h))

    # Background (gradient simulation via two rectangles)
    c.setFillColor(_Hex("#4F46E5"))
    c.rect(0, 0, total_w, total_h, fill=1, stroke=0)
    c.setFillColor(_Hex("#818CF8"))
    c.rect(0, total_h * 0.6, total_w, total_h * 0.4, fill=1, stroke=0)

    # ── Front cover (rightmost panel) ──
    front_x = total_w - trim_w - bleed
    front_y = bleed
    c.setFillColor(_Hex("#EEF2FF"))
    c.roundRect(front_x, front_y, trim_w, trim_h, 0, fill=1, stroke=0)

    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(_Hex("#1E293B"))
    # Title (wrapped manually for basic layout)
    words = title.split()
    lines: List[str] = []
    line: List[str] = []
    for w in words:
        line.append(w)
        if len(" ".join(line)) > 20:
            lines.append(" ".join(line[:-1]))
            line = [w]
    if line:
        lines.append(" ".join(line))
    y_pos = front_y + trim_h - 1.0 * _inch
    for ln in lines[:4]:
        c.drawCentredString(front_x + trim_w / 2, y_pos, ln)
        y_pos -= 0.4 * _inch

    if author:
        c.setFont("Helvetica-Oblique", 14)
        c.setFillColor(_Hex("#6366F1"))
        c.drawCentredString(front_x + trim_w / 2, front_y + 0.4 * _inch, f"by {author}")

    # Barcode placeholder
    c.setFillColor(_Hex("#FFFFFF"))
    c.rect(front_x + 0.3 * _inch, front_y + 0.1 * _inch, 1.4 * _inch, 0.6 * _inch, fill=1, stroke=1)
    c.setFillColor(_Hex("#64748B"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(front_x + 1.0 * _inch, front_y + 0.35 * _inch, "BARCODE")

    # ── Spine ──
    spine_x = total_w - trim_w - bleed - spine_w
    c.setFillColor(_Hex("#4F46E5"))
    c.rect(spine_x, bleed, spine_w, trim_h, fill=1, stroke=0)
    if spine_w > 0.3 * _inch:
        c.saveState()
        c.translate(spine_x + spine_w / 2, bleed + trim_h / 2)
        c.rotate(90)
        c.setFillColor(_Hex("#FFFFFF"))
        font_size = min(12, int(spine_w * 60))
        c.setFont("Helvetica-Bold", font_size)
        spine_text = f"{title}  |  {author}" if author else title
        c.drawCentredString(0, 0, spine_text[:50])
        c.restoreState()

    # ── Back cover ──
    back_x = bleed
    back_y = bleed
    c.setFillColor(_Hex("#E0E7FF"))
    c.rect(back_x, back_y, trim_w, trim_h, fill=1, stroke=0)

    c.setFillColor(_Hex("#1E293B"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(back_x + 0.4 * _inch, back_y + trim_h - 0.6 * _inch, title)

    # Description text (simple line wrap)
    c.setFont("Helvetica", 10)
    c.setFillColor(_Hex("#374151"))
    desc = description[:400] if description else "A magical story for young readers."
    text_obj = c.beginText(back_x + 0.4 * _inch, back_y + trim_h - 1.0 * _inch)
    text_obj.setFont("Helvetica", 10)
    text_obj.setFillColor(_Hex("#374151"))
    text_obj.setLeading(16)
    # Naive word wrap at ~45 chars
    words2 = desc.split()
    cur_line: List[str] = []
    for wd in words2:
        cur_line.append(wd)
        if len(" ".join(cur_line)) > 45:
            text_obj.textLine(" ".join(cur_line[:-1]))
            cur_line = [wd]
    if cur_line:
        text_obj.textLine(" ".join(cur_line))
    c.drawText(text_obj)

    # Spine width note for printer
    c.setFont("Helvetica", 7)
    c.setFillColor(_Hex("#94A3B8"))
    c.drawString(back_x + 0.2 * _inch, back_y + 0.15 * _inch,
                 f"Spine: {spine_w / _inch:.4f}\" ({page_count}pp × {_PAPER_THICKNESS_INCHES}\" paper)")

    c.save()
    buf.seek(0)
    return buf


def _build_epub(project: dict, pages: List[dict]) -> BytesIO:
    """
    Generate an EPUB 3.0 file for Kindle / Apple Books / Kobo.
    Built purely with stdlib zipfile — no external epub library required.
    """
    import zipfile as _zf
    import textwrap as _tw

    meta = project.get("publishing_metadata") or {}
    title = project.get("title", "Untitled")
    author = meta.get("author_name") or meta.get("pen_name") or "Unknown Author"
    language = meta.get("language") or "en"
    description = meta.get("book_description") or project.get("summary", "")
    book_id = f"urn:uuid:{project.get('id', str(uuid.uuid4()))}"
    pub_date = (meta.get("publication_date") or datetime.utcnow().strftime("%Y-%m-%d"))[:10]

    sorted_pages = sorted(pages, key=lambda p: p.get("page_number", 0))

    buf = BytesIO()
    with _zf.ZipFile(buf, "w", _zf.ZIP_DEFLATED) as zf:
        # mimetype MUST be first and uncompressed
        zf.writestr(_zf.ZipInfo("mimetype"), "application/epub+zip")

        # META-INF/container.xml
        zf.writestr("META-INF/container.xml", """\
<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>""")

        # Build spine manifest items
        page_items = ""
        spine_items = ""
        for pg in sorted_pages:
            pnum = pg.get("page_number", 0)
            page_items += f'    <item id="page{pnum}" href="page{pnum}.xhtml" media-type="application/xhtml+xml"/>\n'
            spine_items += f'    <itemref idref="page{pnum}"/>\n'

        # EPUB/content.opf
        opf = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{_xml_escape(title)}</dc:title>
    <dc:creator>{_xml_escape(author)}</dc:creator>
    <dc:language>{language}</dc:language>
    <dc:identifier id="bookid">{book_id}</dc:identifier>
    <dc:date>{pub_date}</dc:date>
    <dc:description>{_xml_escape(description[:500])}</dc:description>
  </metadata>
  <manifest>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>
{page_items}  </manifest>
  <spine toc="toc">
    <itemref idref="titlepage"/>
{spine_items}  </spine>
</package>"""
        zf.writestr("EPUB/content.opf", opf)

        # EPUB/titlepage.xhtml
        hook = project.get("hook", "")
        titlepage_html = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{language}">
<head><meta charset="UTF-8"/><title>{_xml_escape(title)}</title>
<style>
  body {{ font-family: Georgia, serif; text-align: center; margin: 2em; }}
  h1 {{ font-size: 2em; color: #1E293B; }}
  p.hook {{ font-style: italic; color: #6366F1; font-size: 1.1em; }}
  p.author {{ color: #64748B; }}
</style>
</head>
<body>
  <h1>{_xml_escape(title)}</h1>
  {f'<p class="hook">{_xml_escape(hook)}</p>' if hook else ''}
  <p class="author">by {_xml_escape(author)}</p>
</body>
</html>"""
        zf.writestr("EPUB/titlepage.xhtml", titlepage_html)

        # EPUB/page{n}.xhtml for each page
        for pg in sorted_pages:
            pnum = pg.get("page_number", 0)
            text = pg.get("page_text", "").strip() or "(Illustration page)"
            page_html = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{language}">
<head><meta charset="UTF-8"/><title>Page {pnum}</title>
<style>
  body {{ font-family: Georgia, serif; margin: 1.5em; }}
  p.text {{ font-size: 1.3em; line-height: 1.7; color: #1E293B; text-align: center; }}
  p.page-num {{ color: #94A3B8; font-size: 0.9em; text-align: center; }}
</style>
</head>
<body>
  <p class="page-num">Page {pnum}</p>
  <p class="text">{_xml_escape(text)}</p>
</body>
</html>"""
            zf.writestr(f"EPUB/page{pnum}.xhtml", page_html)

        # EPUB/nav.xhtml
        nav_items = f'<li><a href="titlepage.xhtml">Title Page</a></li>\n'
        for pg in sorted_pages:
            pnum = pg.get("page_number", 0)
            nav_items += f'      <li><a href="page{pnum}.xhtml">Page {pnum}</a></li>\n'
        nav_html = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{language}">
<head><meta charset="UTF-8"/><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc">
    <h1>Contents</h1>
    <ol>
      {nav_items}
    </ol>
  </nav>
</body>
</html>"""
        zf.writestr("EPUB/nav.xhtml", nav_html)

        # EPUB/toc.ncx (NCX for older readers)
        nav_points = ""
        for i, pg in enumerate(sorted_pages, start=2):
            pnum = pg.get("page_number", 0)
            nav_points += f"""\
    <navPoint id="np{pnum}" playOrder="{i}">
      <navLabel><text>Page {pnum}</text></navLabel>
      <content src="page{pnum}.xhtml"/>
    </navPoint>\n"""
        ncx = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="{book_id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>{_xml_escape(title)}</text></docTitle>
  <navMap>
    <navPoint id="np0" playOrder="1">
      <navLabel><text>Title Page</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>
{nav_points}  </navMap>
</ncx>"""
        zf.writestr("EPUB/toc.ncx", ncx)

    buf.seek(0)
    return buf


def _xml_escape(text: str) -> str:
    """Minimal XML/HTML escaping for EPUB content."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _build_metadata_json(project: dict, fmt: dict) -> str:
    """Serialise project publishing metadata to a JSON string."""
    meta = project.get("publishing_metadata") or {}
    page_count = project.get("page_count", 0)
    trim_w_h = _TRIM_SIZES.get(fmt.get("trim_size", "8x8"), (8.0, 8.0))
    spine_in = round(page_count * _PAPER_THICKNESS_INCHES, 4)
    return json.dumps({
        "title": project.get("title", ""),
        "project_id": project.get("id", ""),
        "book_metadata": meta,
        "book_format": fmt,
        "computed": {
            "trim_width_inches": trim_w_h[0],
            "trim_height_inches": trim_w_h[1],
            "spine_width_inches": spine_in,
            "page_count": page_count,
        },
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": "Rainstorms Publishing Center",
    }, indent=2)


def _platform_checklist_notes(platform: str) -> str:
    """Return platform-specific submission notes."""
    notes = {
        "kdp": (
            "AMAZON KDP SUBMISSION NOTES\n"
            "----------------------------\n"
            "- Upload interior.pdf as the manuscript\n"
            "- Upload cover.pdf as the book cover\n"
            "- Upload ebook.epub for the Kindle version\n"
            "- Recommended children's book trim: 8.5x11 or 8x10\n"
            "- KDP requires PDF/X-1a or PDF/X-3 for print\n"
            "- Ensure all images are embedded at 300 DPI\n"
            "- Visit: https://kdp.amazon.com\n"
        ),
        "ingram": (
            "INGRAMSPARK SUBMISSION NOTES\n"
            "-----------------------------\n"
            "- Upload interior.pdf (PDF/X-1a preferred)\n"
            "- Upload cover.pdf (include bleeds)\n"
            "- Supported children's trim sizes: 8x8, 8.5x8.5, 10x8\n"
            "- Minimum order: 1 copy\n"
            "- Visit: https://myaccount.ingramspark.com\n"
        ),
        "lulu": (
            "LULU SUBMISSION NOTES\n"
            "----------------------\n"
            "- Upload interior.pdf via Lulu's book creator\n"
            "- Upload cover.pdf separately\n"
            "- Supported children's trim sizes: 8x8, 8.5x11, 10x8\n"
            "- Lulu supports direct proof ordering\n"
            "- Visit: https://www.lulu.com\n"
        ),
    }
    return notes.get(platform, "")


async def _build_publishing_zip(project: dict, pages: List[dict], fmt: dict, platform: str) -> BytesIO:
    """
    Assemble a ZIP export package for the given publishing platform.
    Contains: interior.pdf, cover.pdf, ebook.epub, metadata.json, publishing_checklist.txt
    """
    import zipfile as _zf

    issues = _validate_project_for_print(project, pages, fmt)
    checklist_text = _publishing_checklist(project, fmt, issues)
    platform_notes = _platform_checklist_notes(platform)
    if platform_notes:
        checklist_text += "\n\n" + platform_notes

    interior_pdf = _build_interior_pdf(project, pages, fmt)
    cover_pdf = _build_cover_pdf(project, fmt)
    epub_bytes = _build_epub(project, pages)
    meta_json = _build_metadata_json(project, fmt)

    title_slug = project.get("title", "book").lower().replace(" ", "_")[:30]
    folder = f"{title_slug}_{platform}_export"

    zip_buf = BytesIO()
    with _zf.ZipFile(zip_buf, "w", _zf.ZIP_DEFLATED) as zf:
        zf.writestr(f"{folder}/interior.pdf", interior_pdf.getvalue())
        zf.writestr(f"{folder}/cover.pdf", cover_pdf.getvalue())
        zf.writestr(f"{folder}/ebook.epub", epub_bytes.getvalue())
        zf.writestr(f"{folder}/metadata.json", meta_json)
        zf.writestr(f"{folder}/publishing_checklist.txt", checklist_text)
        # Placeholder for cover_preview.jpg (real implementation would use Pillow)
        zf.writestr(f"{folder}/cover_preview.jpg",
                    b"PLACEHOLDER: Replace with generated cover preview image")

    zip_buf.seek(0)
    return zip_buf


# ── Publishing Center API endpoints ──

@api_router.get("/projects/{project_id}/publishing-center/metadata")
async def get_publishing_metadata(
    project_id: str,
    user=Depends(require_auth),
):
    """
    GET /api/projects/{id}/publishing-center/metadata
    Return the book metadata and format settings for the project.
    """
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "book_metadata": project.get("publishing_metadata") or BookMetadata().dict(),
        "book_format": project.get("book_format") or BookFormatSettings().dict(),
        "series": {
            "series_id": project.get("series_id"),
            "series_order": project.get("series_order"),
            "series_title": project.get("series_title"),
        },
    }


@api_router.put("/projects/{project_id}/publishing-center/metadata")
async def save_publishing_metadata(
    project_id: str,
    body: PublishingMetadataUpdate,
    user=Depends(require_auth),
):
    """
    PUT /api/projects/{id}/publishing-center/metadata
    Save book metadata and/or format settings for the project.
    """
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    if body.book_metadata is not None:
        # Validate via model
        validated_meta = BookMetadata(**{
            **BookMetadata().dict(),
            **{k: v for k, v in body.book_metadata.items() if k in BookMetadata.__fields__},
        })
        updates["publishing_metadata"] = validated_meta.dict()
    if body.book_format is not None:
        validated_fmt = BookFormatSettings(**{
            **BookFormatSettings().dict(),
            **{k: v for k, v in body.book_format.items() if k in BookFormatSettings.__fields__},
        })
        updates["book_format"] = validated_fmt.dict()

    await db.projects.update_one({"id": project_id}, {"$set": updates})
    logger.info("Publishing metadata saved for project %s", project_id)
    return {
        "book_metadata": updates.get("publishing_metadata") or project.get("publishing_metadata") or BookMetadata().dict(),
        "book_format": updates.get("book_format") or project.get("book_format") or BookFormatSettings().dict(),
    }


@api_router.post("/projects/{project_id}/publishing-center/validate")
async def validate_for_print(
    project_id: str,
    user=Depends(require_auth),
):
    """
    POST /api/projects/{id}/publishing-center/validate
    Run print-readiness validation checks and return a list of issues.
    """
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(100)
    fmt = project.get("book_format") or BookFormatSettings().dict()

    issues = _validate_project_for_print(project, pages, fmt)
    errors = [i for i in issues if i["level"] == "error"]
    warnings = [i for i in issues if i["level"] == "warning"]

    return {
        "ready": len(errors) == 0,
        "issue_count": len(issues),
        "errors": errors,
        "warnings": warnings,
        "issues": issues,
    }


@api_router.get("/projects/{project_id}/publishing-center/export/{platform}")
async def export_publishing_package(
    project_id: str,
    platform: str,
    user=Depends(require_auth),
):
    """
    GET /api/projects/{id}/publishing-center/export/{platform}
    Generate and download a ZIP publishing package for the given platform.
    Platform values: kdp | ingram | lulu | all
    """
    if platform not in {"kdp", "ingram", "lulu", "all"}:
        raise HTTPException(
            status_code=422,
            detail="platform must be one of: kdp, ingram, lulu, all"
        )

    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(100)
    fmt = project.get("book_format") or BookFormatSettings().dict()

    zip_buf = await _build_publishing_zip(project, pages, fmt, platform)

    title_slug = project.get("title", "book").lower().replace(" ", "_")[:30]
    filename = f"{title_slug}_{platform}_publishing.zip"

    logger.info("Publishing export %s for project %s (%d pages)", platform, project_id, len(pages))
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ==================== PAGE LAYOUT ENGINE ====================

# ── Dimensions (in points; 72 pt per inch) for each trim size ──────────────

_LAYOUT_DIMS: dict = {
    "8x8":    {"w": 576, "h": 576},
    "8.5x8.5": {"w": 612, "h": 612},
    "8.5x11": {"w": 612, "h": 792},
    "10x8":   {"w": 720, "h": 576},
}
_DEFAULT_LAYOUT_DIM = {"w": 576, "h": 576}
# Safe margin (in points) for print-safe zones
_SAFE_MARGIN = 36  # 0.5 inch


def _auto_select_layout(page_text: str, emotional_beat: str, page_number: int, total_pages: int) -> str:
    """
    Choose an appropriate layout type for a page based on text length,
    emotional intensity, and narrative position.

    Decision rules:
    - climax / near-end → full_spread
    - short text (≤ 30 words) + strong beat → full_illustration_text_overlay
    - short text (≤ 50 words) → full_illustration_text_bottom
    - long text (> 80 words) → spot_illustration
    - all other cases → split_top_bottom
    """
    word_count = len(page_text.split()) if page_text else 0
    beat_lower = emotional_beat.lower() if emotional_beat else ""

    # Story position ratio
    position_ratio = page_number / max(total_pages, 1)

    # Climax signals.
    # Pages in the 60–85% position range are considered climax territory in a standard
    # three-act children's book structure (setup ends ~25%, midpoint ~50%, climax ~65–80%).
    climax_words = {"climax", "triumph", "defeat", "transformation", "revelation", "turning point"}
    is_climax = any(w in beat_lower for w in climax_words) or (0.6 <= position_ratio <= 0.85)

    # A word count of 25 or fewer is appropriate for a full spread: the panoramic
    # image should dominate and the text is a brief caption or exclamation.
    if is_climax and word_count <= 25:
        return "full_spread"

    strong_beat_words = {"courage", "wonder", "magic", "love", "fear", "joy", "awe", "power"}
    has_strong_beat = any(w in beat_lower for w in strong_beat_words)

    if word_count <= 30 and has_strong_beat:
        return "full_illustration_text_overlay"

    if word_count <= 55:
        return "full_illustration_text_bottom"

    if word_count > 80:
        return "spot_illustration"

    return "split_top_bottom"


def _build_layout_boxes(layout_type: str, trim_size: str) -> dict:
    """
    Compute image_box, text_box, font_size, and alignment for the given layout type
    and trim size. All coordinates are in points (72 pt = 1 inch).

    Returns a dict matching PageLayoutData fields.
    """
    dim = _LAYOUT_DIMS.get(trim_size, _DEFAULT_LAYOUT_DIM)
    w, h = dim["w"], dim["h"]
    m = _SAFE_MARGIN  # safe margin

    if layout_type == "full_illustration_text_bottom":
        text_height = max(120, int(h * 0.22))
        image_height = h - text_height - m
        return {
            "layout_type": layout_type,
            "image_box": {"x": 0, "y": 0, "width": w, "height": image_height},
            "text_box": {"x": m, "y": image_height + int(m / 2), "width": w - 2 * m, "height": text_height - int(m / 2)},
            "font_size": 34,
            "alignment": "center",
            "print_safe": True,
            "gutter_safe": True,
        }

    if layout_type == "full_illustration_text_overlay":
        strip_height = max(100, int(h * 0.18))
        return {
            "layout_type": layout_type,
            "image_box": {"x": 0, "y": 0, "width": w, "height": h},
            "text_box": {"x": m, "y": h - strip_height, "width": w - 2 * m, "height": strip_height - m},
            "font_size": 36,
            "alignment": "center",
            "print_safe": True,
            "gutter_safe": True,
        }

    if layout_type == "split_top_bottom":
        split_y = int(h * 0.52)
        return {
            "layout_type": layout_type,
            "image_box": {"x": 0, "y": 0, "width": w, "height": split_y},
            "text_box": {"x": m, "y": split_y + m, "width": w - 2 * m, "height": h - split_y - 2 * m},
            "font_size": 30,
            "alignment": "left",
            "print_safe": True,
            "gutter_safe": True,
        }

    if layout_type == "full_spread":
        # Spread: double-width canvas; gutter in the centre
        spread_w = w * 2
        gutter = int(spread_w * 0.04)
        text_height = max(110, int(h * 0.20))
        return {
            "layout_type": layout_type,
            "image_box": {"x": 0, "y": 0, "width": spread_w, "height": h - text_height},
            "text_box": {"x": gutter + m, "y": h - text_height, "width": spread_w - 2 * (gutter + m), "height": text_height - m},
            "font_size": 38,
            "alignment": "center",
            "print_safe": True,
            "gutter_safe": True,
        }

    if layout_type == "spot_illustration":
        img_size = int(min(w, h) * 0.38)
        return {
            "layout_type": layout_type,
            "image_box": {"x": w - img_size - m, "y": m, "width": img_size, "height": img_size},
            "text_box": {"x": m, "y": m, "width": w - img_size - 3 * m, "height": h - 2 * m},
            "font_size": 28,
            "alignment": "left",
            "print_safe": True,
            "gutter_safe": True,
        }

    # Fallback → split
    return _build_layout_boxes("split_top_bottom", trim_size)


def _apply_layout_to_page(page: dict, total_pages: int, trim_size: str) -> dict:
    """
    Compute and return a PageLayoutData dict for a single page document.
    """
    layout_type = _auto_select_layout(
        page.get("page_text", ""),
        page.get("emotional_beat", ""),
        page.get("page_number", 1),
        total_pages,
    )
    return _build_layout_boxes(layout_type, trim_size)


# ── Layout endpoints ──────────────────────────────────────────────────────────

@api_router.get("/layout-types")
async def get_layout_types():
    """
    GET /api/layout-types
    Return the supported layout types with display metadata.
    """
    return {
        "layout_types": [
            {"key": k, **v} for k, v in LAYOUT_TYPES.items()
        ]
    }


@api_router.get("/page-themes")
async def get_page_themes():
    """
    GET /api/page-themes
    Return the preset page themes.
    """
    return {
        "themes": [
            {"key": k, **v} for k, v in PAGE_THEMES.items()
        ],
        "default": DEFAULT_PAGE_THEME,
    }


@api_router.put("/projects/{project_id}/page-theme")
async def update_page_theme(
    project_id: str,
    body: PageThemeUpdate,
    user=Depends(get_current_user),
):
    """
    PUT /api/projects/{id}/page-theme
    Set the page theme for a project.
    """
    if body.theme_key not in PAGE_THEMES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown theme '{body.theme_key}'. Valid: {list(PAGE_THEMES.keys())}",
        )
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"page_theme": body.theme_key, "updated_at": datetime.utcnow()}},
    )
    return {
        "project_id": project_id,
        "page_theme": body.theme_key,
        "theme": PAGE_THEMES[body.theme_key],
    }


@api_router.post("/projects/{project_id}/pages/{page_id}/layout/auto")
async def auto_layout_page(
    project_id: str,
    page_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{project_id}/pages/{page_id}/layout/auto
    Automatically compute and store a layout for one page.
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    page = await db.pages.find_one({"id": page_id, "project_id": project_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    total_pages = await db.pages.count_documents({"project_id": project_id})
    trim_size = (project.get("book_format") or {}).get("trim_size", "8x8")

    layout = _apply_layout_to_page(page, total_pages, trim_size)

    await db.pages.update_one(
        {"id": page_id},
        {"$set": {"page_layout": layout, "updated_at": datetime.utcnow()}},
    )
    return {"page_id": page_id, "page_layout": layout}


@api_router.post("/projects/{project_id}/layout/batch")
async def auto_layout_all_pages(
    project_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{project_id}/layout/batch
    Automatically compute and store layouts for all pages in the project.
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(100)
    if not pages:
        raise HTTPException(status_code=404, detail="No pages found for project")

    total_pages = len(pages)
    trim_size = (project.get("book_format") or {}).get("trim_size", "8x8")

    results = []
    for page in pages:
        layout = _apply_layout_to_page(page, total_pages, trim_size)
        await db.pages.update_one(
            {"id": page["id"]},
            {"$set": {"page_layout": layout, "updated_at": datetime.utcnow()}},
        )
        results.append({"page_id": page["id"], "page_number": page["page_number"], "layout_type": layout["layout_type"], "page_layout": layout})

    logger.info("Batch layout completed for project %s: %d pages", project_id, total_pages)
    return {"project_id": project_id, "layouts_applied": len(results), "results": results}


@api_router.put("/projects/{project_id}/pages/{page_id}/layout")
async def update_page_layout(
    project_id: str,
    page_id: str,
    body: PageLayoutOverride,
    user=Depends(get_current_user),
):
    """
    PUT /api/projects/{project_id}/pages/{page_id}/layout
    Manually override one or more layout properties for a page.
    """
    page = await db.pages.find_one({"id": page_id, "project_id": project_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    # Start from current layout or compute a default
    project = await db.projects.find_one({"id": project_id})
    trim_size = (project.get("book_format") or {}).get("trim_size", "8x8") if project else "8x8"

    current_layout: dict = page.get("page_layout") or _build_layout_boxes(
        "full_illustration_text_bottom", trim_size
    )

    # Apply overrides
    if body.layout_type:
        if body.layout_type not in LAYOUT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown layout_type '{body.layout_type}'. Valid: {list(LAYOUT_TYPES.keys())}",
            )
        # Recompute boxes for the new layout type but allow further box overrides
        current_layout = _build_layout_boxes(body.layout_type, trim_size)

    if body.font_size is not None:
        current_layout["font_size"] = body.font_size
    if body.alignment is not None:
        current_layout["alignment"] = body.alignment
    if body.image_box is not None:
        current_layout["image_box"] = body.image_box
    if body.text_box is not None:
        current_layout["text_box"] = body.text_box

    await db.pages.update_one(
        {"id": page_id},
        {"$set": {"page_layout": current_layout, "updated_at": datetime.utcnow()}},
    )
    return {"page_id": page_id, "page_layout": current_layout}



def _build_character_visual_brief(char: dict) -> str:
    """
    Build a compact visual description for a character suitable for injection into
    illustration prompts.

    Only includes fields that are non-empty, prioritising locked visual profile data.

    The `clothing` field may use semicolons to separate multiple states
    (e.g. "pajamas; as Captain Blanket: quilt cape") — this is intentional and
    provides the LLM with context-aware wardrobe information in a single string.
    """
    parts: list[str] = []

    name = char.get("name", "")
    if not name:
        return ""

    parts.append(name)

    appearance = char.get("appearance", "").strip()
    if appearance:
        parts.append(appearance)

    color_palette = char.get("color_palette", "").strip()
    if color_palette:
        parts.append(f"colors: {color_palette}")

    clothing = char.get("clothing", "").strip()
    if clothing:
        parts.append(f"wearing: {clothing}")

    unique_traits = char.get("unique_traits", "").strip()
    if unique_traits:
        parts.append(unique_traits)

    return ", ".join(parts)


def _detect_characters_in_text(page_text: str, characters: List[dict]) -> List[dict]:
    """
    Detect which characters from a project appear in a page's text.

    Performs a simple case-insensitive name-match on the page text.
    Returns the matching character dicts.
    """
    text_lower = page_text.lower()
    detected: list[dict] = []
    for char in characters:
        name = char.get("name", "").strip()
        if name and name.lower() in text_lower:
            detected.append(char)
    return detected


async def _generate_reference_sheet_image(char_id: str, char: dict) -> str:
    """
    Generate a character reference sheet image using DALL-E and save it.

    Returns:
        Relative URL to the saved image, or empty string on failure.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping reference sheet generation")
        return ""

    name = char.get("name", "character")
    brief = _build_character_visual_brief(char)
    role = char.get("role", "character")

    prompt = (
        f"Character reference sheet for '{name}', a {role} in a children's picture book. "
        f"Visual description: {brief}. "
        "Show the character from the front with clean background. "
        "Include their key visual traits clearly. "
        "Style: soft watercolor children's book illustration, clean white background, "
        "expressive and friendly design suitable for ages 3-8."
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt[:4096],
                    "n": 1,
                    "size": "1024x1024",
                    "response_format": "b64_json",
                    "quality": "standard",
                },
            )
        if len(prompt) > 4096:
            logger.warning(
                "Reference sheet prompt truncated from %d to 4096 chars for character %s",
                len(prompt), char.get("name", char_id),
            )
        response.raise_for_status()
        data = response.json()
        image_b64 = data["data"][0]["b64_json"]
    except httpx.HTTPStatusError as exc:
        logger.error("Reference sheet HTTP error %s: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Reference sheet generation failed: %s", exc)
        return ""

    char_dir = CHARACTERS_DIR / char_id
    char_dir.mkdir(parents=True, exist_ok=True)
    image_path = char_dir / "reference_sheet.png"
    image_bytes = base64.b64decode(image_b64)
    image_path.write_bytes(image_bytes)

    logger.info("Reference sheet saved: %s (%d bytes)", image_path, len(image_bytes))
    return f"/static/characters/{char_id}/reference_sheet.png"


@api_router.post("/characters/{character_id}/reference-sheet")
async def generate_character_reference_sheet(
    character_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/characters/{id}/reference-sheet
    Generate a DALL-E reference sheet image for the character.
    Stores the URL on the character document.
    """
    char = await db.characters.find_one({"id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Image generation is not available. Set OPENAI_API_KEY in the backend .env file.",
        )

    reference_sheet_url = await _generate_reference_sheet_image(character_id, char)
    if not reference_sheet_url:
        raise HTTPException(status_code=503, detail="Reference sheet generation failed.")

    await db.characters.update_one(
        {"id": character_id},
        {"$set": {"reference_sheet_url": reference_sheet_url}},
    )
    return {"character_id": character_id, "reference_sheet_url": reference_sheet_url}


@api_router.post("/characters/{character_id}/lock")
async def lock_character_appearance(
    character_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/characters/{id}/lock
    Lock the character's visual appearance so it cannot be auto-changed.
    """
    char = await db.characters.find_one({"id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    await db.characters.update_one(
        {"id": character_id},
        {"$set": {"appearance_locked": True}},
    )
    return {"character_id": character_id, "appearance_locked": True}


@api_router.post("/characters/{character_id}/unlock")
async def unlock_character_appearance(
    character_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/characters/{id}/unlock
    Unlock the character's visual appearance.
    """
    char = await db.characters.find_one({"id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    await db.characters.update_one(
        {"id": character_id},
        {"$set": {"appearance_locked": False}},
    )
    return {"character_id": character_id, "appearance_locked": False}


class CharacterDetectionRequest(BaseModel):
    page_text: str


@api_router.post("/projects/{project_id}/detect-characters")
async def detect_characters_in_page(
    project_id: str,
    body: CharacterDetectionRequest,
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{id}/detect-characters
    Detect which characters (by name) appear in a page text.
    Returns the matching characters with their visual profiles.
    """
    characters = await db.characters.find({"project_id": project_id}).to_list(20)
    detected = _detect_characters_in_text(body.page_text, characters)
    return {
        "detected_count": len(detected),
        "characters": [
            {
                "id": c["id"],
                "name": c["name"],
                "visual_brief": _build_character_visual_brief(c),
                "appearance_locked": c.get("appearance_locked", False),
            }
            for c in detected
        ],
    }


# ==================== ILLUSTRATION SYSTEM ====================

async def _generate_illustration_image(
    prompt: str,
    style_preset: str,
    project_id: str,
    page_id: str,
) -> str:
    """
    Generate an illustration for a single page using OpenAI's image generation API.
    Saves the image to the local static directory and returns the relative URL path.

    Args:
        prompt: The illustration prompt text.
        style_preset: The style preset key (e.g. "watercolor").
        project_id: Used for file path organization.
        page_id: Used for file naming.

    Returns:
        Relative URL path to the saved image (e.g. "/static/illustrations/...").
        Returns empty string if image generation is not configured or fails.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping image generation")
        return ""

    # Append the style suffix to the prompt
    style = STYLE_PRESETS.get(style_preset, STYLE_PRESETS[DEFAULT_STYLE_PRESET])
    full_prompt = f"{prompt}\n\n{style['suffix']}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": full_prompt[:4096],  # DALL-E 3 max prompt length
                    "n": 1,
                    "size": "1024x1024",
                    "response_format": "b64_json",
                    "quality": "standard",
                },
            )
        response.raise_for_status()
        data = response.json()
        image_b64 = data["data"][0]["b64_json"]

    except httpx.HTTPStatusError as exc:
        logger.error("Image generation HTTP error %s: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Image generation failed: %s", exc)
        return ""

    # Save image to local static directory
    proj_dir = ILLUSTRATIONS_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)
    image_path = proj_dir / f"{page_id}.png"

    image_bytes = base64.b64decode(image_b64)
    image_path.write_bytes(image_bytes)

    logger.info("Illustration saved: %s (%d bytes)", image_path, len(image_bytes))
    return f"/static/illustrations/{project_id}/{page_id}.png"


@api_router.get("/illustration-styles")
async def get_illustration_styles():
    """Return available illustration style presets."""
    return {
        "styles": [
            {"key": key, "label": v["label"], "emoji": v["emoji"]}
            for key, v in STYLE_PRESETS.items()
        ],
        "default": DEFAULT_STYLE_PRESET,
    }


@api_router.put("/projects/{project_id}/illustration-style")
async def update_illustration_style(
    project_id: str,
    body: IllustrationStyleUpdate,
    user=Depends(get_current_user),
):
    """
    PUT /api/projects/{id}/illustration-style
    Set the illustration style preset for a project (style lock system).
    """
    if body.style_preset not in STYLE_PRESETS:
        raise HTTPException(
            status_code=422,
            detail=f"style_preset must be one of: {list(STYLE_PRESETS.keys())}"
        )
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"illustration_style": body.style_preset, "updated_at": datetime.utcnow()}}
    )
    preset = STYLE_PRESETS[body.style_preset]
    return {
        "project_id": project_id,
        "illustration_style": body.style_preset,
        "label": preset["label"],
        "emoji": preset["emoji"],
    }


@api_router.post("/projects/{project_id}/pages/{page_id}/illustrations/generate")
async def generate_page_illustration(
    project_id: str,
    page_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{id}/pages/{page_id}/illustrations/generate
    Generate an illustration image for a single page and store the URL in the page document.
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    page = await db.pages.find_one({"id": page_id, "project_id": project_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    prompt = page.get("illustration_prompt", "").strip()
    if not prompt:
        raise HTTPException(
            status_code=422,
            detail="Page has no illustration prompt. Generate a prompt first."
        )

    style_preset = project.get("illustration_style", DEFAULT_STYLE_PRESET)
    illustration_url = await _generate_illustration_image(
        prompt=prompt,
        style_preset=style_preset,
        project_id=project_id,
        page_id=page_id,
    )

    if not illustration_url:
        raise HTTPException(
            status_code=503,
            detail=(
                "Image generation is not available. "
                "Set OPENAI_API_KEY in the backend .env file to enable this feature."
            )
        )

    await db.pages.update_one(
        {"id": page_id},
        {"$set": {"illustration_url": illustration_url, "updated_at": datetime.utcnow()}}
    )
    logger.info("Illustration generated for page %s (project %s)", page_id, project_id)
    return {
        "page_id": page_id,
        "illustration_url": illustration_url,
        "style_preset": style_preset,
    }


@api_router.post("/projects/{project_id}/illustrations/batch")
async def batch_generate_illustrations(
    project_id: str,
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{id}/illustrations/batch
    Generate illustrations for ALL pages in the project that have an illustration_prompt.
    Returns a summary of successes and failures — does not stop on individual page errors.
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Image generation is not available. "
                "Set OPENAI_API_KEY in the backend .env file to enable this feature."
            )
        )

    pages = await db.pages.find({"project_id": project_id}).sort("page_number", 1).to_list(100)
    style_preset = project.get("illustration_style", DEFAULT_STYLE_PRESET)

    results = []
    success_count = 0
    skip_count = 0
    fail_count = 0

    for page in pages:
        page_id = page["id"]
        page_number = page.get("page_number", "?")
        prompt = page.get("illustration_prompt", "").strip()

        if not prompt:
            skip_count += 1
            results.append({"page_id": page_id, "page_number": page_number, "status": "skipped", "reason": "no prompt"})
            continue

        illustration_url = await _generate_illustration_image(
            prompt=prompt,
            style_preset=style_preset,
            project_id=project_id,
            page_id=page_id,
        )

        if illustration_url:
            await db.pages.update_one(
                {"id": page_id},
                {"$set": {"illustration_url": illustration_url, "updated_at": datetime.utcnow()}}
            )
            success_count += 1
            results.append({"page_id": page_id, "page_number": page_number, "status": "success", "illustration_url": illustration_url})
        else:
            fail_count += 1
            results.append({"page_id": page_id, "page_number": page_number, "status": "failed"})

    logger.info(
        "Batch illustration complete for project %s: %d success, %d skipped, %d failed",
        project_id, success_count, skip_count, fail_count
    )
    return {
        "project_id": project_id,
        "style_preset": style_preset,
        "total_pages": len(pages),
        "success_count": success_count,
        "skip_count": skip_count,
        "fail_count": fail_count,
        "results": results,
    }


@api_router.delete("/projects/{project_id}/pages/{page_id}/illustrations")
async def delete_page_illustration(
    project_id: str,
    page_id: str,
    user=Depends(get_current_user),
):
    """
    DELETE /api/projects/{id}/pages/{page_id}/illustrations
    Remove the illustration from a page (clears illustration_url and deletes the file).
    """
    page = await db.pages.find_one({"id": page_id, "project_id": project_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    existing_url = page.get("illustration_url", "")
    if existing_url:
        # Remove local file if it exists
        file_path = ROOT_DIR / existing_url.lstrip("/")
        try:
            file_path.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("Could not delete illustration file %s: %s", file_path, exc)

    await db.pages.update_one(
        {"id": page_id},
        {"$set": {"illustration_url": "", "updated_at": datetime.utcnow()}}
    )
    return {"page_id": page_id, "illustration_url": ""}


# ==================== DEMO PROJECT ====================

@api_router.post("/demo/seed")
async def seed_demo_project():
    """Seed the demo project: Captain Blanket and the Midnight Brother"""
    
    # Check if demo already exists
    existing = await db.projects.find_one({"is_demo": True})
    if existing:
        return {"message": "Demo project already exists", "project_id": existing["id"]}
    
    # Create demo project
    demo_project = Project(
        user_id=None,
        title="Captain Blanket and the Midnight Brother",
        original_idea="A child with a magical blanket cape protects his baby brother from night monsters at bedtime and learns what it means to be a big brother hero.",
        tone="cozy, adventurous, bedtime calm",
        age_range="3-8",
        page_count=10,
        theme="The power of love and protection between siblings",
        hook="When darkness falls, one brave big brother discovers that the greatest superpower is love.",
        summary="Oliver discovers his old baby blanket transforms into a magical cape when the clock strikes bedtime. When shadow monsters threaten his baby brother Max's peaceful sleep, Captain Blanket springs into action! Through imagination, courage, and brotherly love, Oliver learns that being a hero isn't about being fearless—it's about protecting the ones you love.",
        outline=[
            "Page 1: Oliver is tucked in bed but hears his baby brother Max fussing. He reaches for his old blanket.",
            "Page 2: The blanket begins to shimmer and transforms into a magnificent cape. Oliver becomes Captain Blanket!",
            "Page 3: Captain Blanket tiptoes to the nursery and sees shadow monsters gathering around Max's crib.",
            "Page 4: The shadows try to steal Max's peaceful dreams. Captain Blanket stands firm.",
            "Page 5: With a swoosh of his cape, Captain Blanket creates a shield of soft, golden light.",
            "Page 6: The shadow monsters shrink back, but their leader—the Nightmare King—appears.",
            "Page 7: Captain Blanket remembers all the times Max smiled at him. Love fills his heart.",
            "Page 8: The love glows so bright that the Nightmare King melts away into starlight.",
            "Page 9: Max coos happily in his sleep. Captain Blanket gives his brother a gentle pat.",
            "Page 10: Oliver hangs up his cape and snuggles in bed, knowing he'll always protect his little brother."
        ],
        is_demo=True,
        publishing_metadata=BookMetadata(
            title="Captain Blanket and the Midnight Brother",
            subtitle="A Story of Bedtime Bravery",
            author_name="Demo Author",
            series_name="Captain Blanket",
            series_number=1,
            book_description=(
                "Oliver discovers his old baby blanket transforms into a magical cape when the "
                "clock strikes bedtime. When shadow monsters threaten his baby brother Max's "
                "peaceful sleep, Captain Blanket springs into action! A cozy bedtime adventure "
                "about the superpower of brotherly love."
            ),
            keywords=["bedtime", "siblings", "bravery", "love", "adventure", "hero", "blanket"],
            age_range="3-8",
            language="en",
            publisher_name="Rainstorms Books",
            copyright_holder="Rainstorms Demo",
            isbn_status="none",
        ).dict(),
        book_format=BookFormatSettings(
            trim_size="8x8",
            bleed_enabled=True,
            paper_type="premium",
            cover_finish="matte",
            interior_color="color",
            font_embedding=True,
        ).dict(),
        series_id="captain_blanket_series",
        series_order=1,
        series_title="Captain Blanket",
    )
    
    await db.projects.insert_one(demo_project.dict())
    
    # Create demo characters
    demo_characters = [
        Character(
            project_id=demo_project.id,
            name="Oliver (Captain Blanket)",
            role="main",
            personality="Brave, imaginative, loving, and protective. He's sometimes scared but always pushes through for his brother. Has a vivid imagination that turns ordinary things magical.",
            appearance="A 5-year-old boy with messy brown hair, bright curious eyes, and rosy cheeks. Wears blue pajamas with stars. As Captain Blanket, he wears a shimmering silver-blue cape that seems to glow softly.",
            special_trait="His love for his baby brother makes his cape glow with golden light",
            notes="Draw him slightly small compared to furniture to emphasize his bravery despite being little",
            color_palette="silver-blue, warm gold highlights, star-white",
            clothing="blue star-pattern pajamas; as Captain Blanket: shimmering silver-blue quilt cape with soft golden glow",
            unique_traits="messy brown hair, rosy cheeks, cape emits warm golden light when love fills his heart",
            appearance_locked=True,
        ),
        Character(
            project_id=demo_project.id,
            name="Baby Max",
            role="supporting",
            personality="Sweet, innocent, and peaceful. Giggles easily and always reaches for Oliver when he sees him.",
            appearance="A chubby 10-month-old baby with wispy blonde hair and big blue eyes. Wears a soft yellow onesie with a duck on it. Always has a peaceful, content expression.",
            special_trait="His innocent smile can light up any dark room",
            notes="Keep him looking cozy and protected in his crib throughout",
            color_palette="soft yellow, warm cream, baby blue",
            clothing="yellow onesie with a small duck embroidery",
            unique_traits="wispy blonde hair, big blue eyes, rosy chubby cheeks, perpetually content expression",
            appearance_locked=True,
        ),
        Character(
            project_id=demo_project.id,
            name="Shadow Monsters",
            role="minor",
            personality="Mischievous but not truly evil—they're more like naughty fears that scatter when confronted with love.",
            appearance="Wispy, purple-gray shapes with big cartoonish yellow eyes. They look more silly than scary, like smoke puppets. They have no defined shape, constantly shifting.",
            special_trait="They shrink when exposed to light or love",
            notes="Keep them non-threatening for young readers—more playful spooky than scary",
            color_palette="purple-gray, smoky dark blue, yellow (eyes only)",
            clothing="no clothing — formless wispy shapes",
            unique_traits="large cartoonish yellow eyes, no fixed shape, slightly translucent edges",
            appearance_locked=False,
        ),
        Character(
            project_id=demo_project.id,
            name="The Nightmare King",
            role="minor",
            personality="Dramatic and pompous but ultimately powerless against love. More bark than bite.",
            appearance="A larger shadow figure wearing a crooked crown made of darkness. Has an exaggerated frown and arms that wave dramatically. Looks like a grumpy cloud.",
            special_trait="Melts into harmless starlight when defeated",
            notes="Make him look huffily defeated rather than scary when he loses",
            color_palette="deep charcoal, dark navy, faint purple",
            clothing="crooked crown of solidified darkness, no other clothing",
            unique_traits="crooked dark crown, exaggerated frown, dramatically waving arms, grumpy-cloud silhouette",
            appearance_locked=False,
        ),
        Character(
            project_id=demo_project.id,
            name="Sir Fluffington",
            role="supporting",
            personality="Dignified, wise, and secretly very playful. Acts regal but can't resist a good nap or a dangling string.",
            appearance="A large, fluffy orange tabby cat with green eyes and a white chest patch. Wears a tiny bow tie. Sits regally but has a permanently surprised eyebrow expression.",
            special_trait="Guides heroes through dark corridors with his glowing green eyes",
            notes="Can appear in background scenes watching Oliver's adventures with a knowing look",
            color_palette="warm orange, cream-white, forest green (eyes)",
            clothing="tiny midnight-blue bow tie with a silver clasp",
            unique_traits="fluffy orange tabby fur, white chest patch, tiny bow tie, one perpetually raised eyebrow, glowing green eyes in darkness",
            appearance_locked=True,
        ),
    ]

    for char in demo_characters:
        await db.characters.insert_one(char.dict())
    
    # Create demo pages with full content
    demo_pages = [
        PageData(
            project_id=demo_project.id,
            page_number=1,
            outline_beat="Oliver is tucked in bed but hears his baby brother Max fussing. He reaches for his old blanket.",
            page_text="Oliver snuggled deep in his cozy bed, but sleep wouldn't come. From the nursery next door, he heard a tiny whimper. Baby Max was fussing again. Oliver reached for his old baby blanket—the soft, silver-blue one that always made him feel brave.",
            emotional_beat="gentle concern, comfort",
            illustration_prompt="A cozy bedroom at night with warm lamp light. A young boy with messy brown hair sits up in bed wearing star-pattern pajamas, looking toward the door with caring concern. His hand reaches for a shimmering silver-blue blanket at the foot of his bed. Soft moonlight streams through the window. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=2,
            outline_beat="The blanket begins to shimmer and transforms into a magnificent cape. Oliver becomes Captain Blanket!",
            page_text="The moment Oliver's fingers touched the blanket, something magical happened. The fabric began to shimmer and sparkle, swirling around his shoulders like a gentle wind. It wasn't just a blanket anymore—it was a magnificent cape! Oliver stood tall. He was Captain Blanket now!",
            emotional_beat="wonder, transformation, excitement",
            illustration_prompt="Magical transformation scene. The silver-blue blanket swirls with sparkles and golden light, wrapping around a young boy's shoulders to become a flowing cape. The boy stands heroically on his bed, arms spread wide, with stars and sparkles surrounding him. His expression shows wonder and newfound courage. The room glows with soft magical light. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=3,
            outline_beat="Captain Blanket tiptoes to the nursery and sees shadow monsters gathering around Max's crib.",
            page_text="Captain Blanket tiptoed down the hallway, his cape floating softly behind him. He peeked into the nursery and gasped! Wispy shadow monsters with big, silly eyes were gathering around Baby Max's crib, whispering and giggling in the darkness.",
            emotional_beat="suspense, protectiveness",
            illustration_prompt="A nighttime nursery scene. A brave boy in blue star pajamas with a glowing silver cape peers around the doorframe. In the center, a white crib holds a sleeping baby. Around the crib, several wispy purple-gray shadow creatures with cartoonish yellow eyes float and creep, more mischievous than scary. Soft nightlight glow. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=4,
            outline_beat="The shadows try to steal Max's peaceful dreams. Captain Blanket stands firm.",
            page_text="The shadow monsters reached their wispy fingers toward Max, trying to steal his sweet dreams. But Captain Blanket stepped forward, planting his feet firmly on the soft carpet. 'Not my brother!' he whispered bravely. 'You can't have his dreams!'",
            emotional_beat="courage, determination",
            illustration_prompt="A young superhero boy stands protectively between shadow monsters and a baby's crib. His silver-blue cape billows behind him as he faces the silly-looking shadow creatures with determination. The shadows reach toward the crib but seem to hesitate. The boy's stance is brave and protective. Warm nightlight illuminates the scene. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=5,
            outline_beat="With a swoosh of his cape, Captain Blanket creates a shield of soft, golden light.",
            page_text="Captain Blanket swooshed his magical cape through the air. Whoooosh! A beautiful shield of soft, golden light spread out around the crib like a warm hug. The shadow monsters squeaked and tumbled backward, covering their big yellow eyes.",
            emotional_beat="triumph, warmth",
            illustration_prompt="Dynamic action scene. A young boy spins with his silver-blue cape creating a swirling arc of golden, warm light that forms a protective dome around a baby's crib. The shadow monsters tumble backward comically, covering their cartoon eyes with wispy arms. Golden sparkles and light rays fill the scene. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=6,
            outline_beat="The shadow monsters shrink back, but their leader—the Nightmare King—appears.",
            page_text="The little shadow monsters scattered and hid behind the rocking chair. But then the room grew darker. A bigger shadow rose up, wearing a crooked crown of darkness. 'I am the Nightmare King!' it boomed in a grumbly voice. 'And I am NOT afraid of little boys!'",
            emotional_beat="tension, challenge",
            illustration_prompt="A dramatic moment in the nursery. Small shadow creatures hide behind furniture while a larger shadow figure with a crooked dark crown rises dramatically in the center. The Nightmare King waves his arms theatrically, looking more pompous than scary. A brave boy with a glowing cape stands his ground, facing the shadow king. Contrast between dark shadows and warm protective light. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=7,
            outline_beat="Captain Blanket remembers all the times Max smiled at him. Love fills his heart.",
            page_text="Captain Blanket felt a tiny bit scared. But then he remembered... Max's first giggle. Max reaching for him with tiny hands. Max's drooly smile every morning. Love filled Oliver's heart until it felt like sunshine was growing inside his chest.",
            emotional_beat="tenderness, love building",
            illustration_prompt="A tender emotional moment. Soft, dreamy vignettes float around a young boy: a baby giggling, tiny hands reaching up, a drooly happy smile. The boy closes his eyes with a peaceful expression as a warm golden glow emanates from his heart, spreading through his cape. The Nightmare King looks uncertain in the background. Soft, warm colors. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=8,
            outline_beat="The love glows so bright that the Nightmare King melts away into starlight.",
            page_text="The love glowed brighter and brighter—brighter than any nightlight! The Nightmare King's crown wobbled. His frown trembled. 'No! Not... not LOVE!' he wailed. And then, poof! He melted away into a shower of tiny, sparkling stars.",
            emotional_beat="victory, joy",
            illustration_prompt="A triumphant climax scene. A young boy radiates brilliant golden light from his heart and cape, filling the entire nursery with warmth. The Nightmare King dramatically melts and transforms into countless tiny sparkles and stars, his crown dissolving last. Small shadow creatures poof into harmless starlight too. The baby sleeps peacefully in the glowing crib. Celebration of light over darkness. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=9,
            outline_beat="Max coos happily in his sleep. Captain Blanket gives his brother a gentle pat.",
            page_text="The nursery was quiet and warm now, filled with gentle starlight. Baby Max cooed happily in his sleep, dreaming sweet dreams once more. Captain Blanket leaned over the crib and gave his baby brother the softest pat. 'I'll always protect you,' he whispered.",
            emotional_beat="peace, tenderness",
            illustration_prompt="A peaceful, touching scene. A young boy in a glowing cape leans gently over a crib, softly patting a content, sleeping baby. The nursery is now filled with soft starlight and a warm glow. The baby has a sweet smile while sleeping. Big brother looks down with pure love and protectiveness. Gentle, warm lighting throughout. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        ),
        PageData(
            project_id=demo_project.id,
            page_number=10,
            outline_beat="Oliver hangs up his cape and snuggles in bed, knowing he'll always protect his little brother.",
            page_text="Back in his room, Oliver hung up his magical cape. It looked just like an ordinary blanket again, but he knew the truth. Whenever Max needed him, the cape would be ready. Oliver snuggled under his covers with the biggest smile. Being a big brother was the best superpower of all.",
            emotional_beat="contentment, love, closure",
            illustration_prompt="A cozy closing scene. A young boy with messy brown hair snuggles happily under his covers, smiling with contentment. His silver-blue blanket hangs on a hook nearby, looking ordinary but with a subtle shimmer. Moonlight streams through the window, stars twinkle outside. The room feels safe, warm, and full of love. Perfect bedtime feeling. Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"
        )
    ]
    
    for page in demo_pages:
        await db.pages.insert_one(page.dict())
    
    return {"message": "Demo project created successfully", "project_id": demo_project.id}

@api_router.get("/demo")
async def get_demo_project():
    """Get the demo project"""
    project = await db.projects.find_one({"is_demo": True})
    if not project:
        # Create demo if it doesn't exist
        await seed_demo_project()
        project = await db.projects.find_one({"is_demo": True})
    
    characters = await db.characters.find({"project_id": project["id"]}).to_list(20)
    pages = await db.pages.find({"project_id": project["id"]}).sort("page_number", 1).to_list(50)
    
    return {
        "project": Project(**project),
        "characters": [Character(**c) for c in characters],
        "pages": [PageData(**p) for p in pages]
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Rainstorms API v1.0", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


def _llm_status() -> dict:
    """Return LLM provider and whether key is configured (no key value)."""
    from ai_helper import LLM_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY
    key_set = False
    if LLM_PROVIDER == "groq":
        key_set = bool(GROQ_API_KEY)
    elif LLM_PROVIDER == "gemini":
        key_set = bool(GEMINI_API_KEY)
    else:
        key_set = bool(OPENAI_API_KEY)
    return {"provider": LLM_PROVIDER, "configured": key_set}


@api_router.get("/ready")
async def ready_check():
    """Check if the API can reach MongoDB and LLM is configured."""
    mongo_ok = False
    mongo_err = None
    try:
        await client.admin.command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_err = str(e)
        logger.error("MongoDB ready check failed: %s", e)

    llm = _llm_status()
    ready = mongo_ok and llm["configured"]
    out = {
        "status": "ready" if ready else "not_ready",
        "mongo": "connected" if mongo_ok else "disconnected",
        "llm": llm,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if mongo_err:
        out["mongo_error"] = mongo_err
    if not llm["configured"]:
        out["hint"] = (
            f"Set {llm['provider'].upper()}_API_KEY in Railway Variables. "
            "For Groq (free): LLM_PROVIDER=groq, GROQ_API_KEY=your_key"
        )
    elif not mongo_ok:
        out["hint"] = "Set MONGO_URL in Railway Variables and allow 0.0.0.0/0 in Atlas Network Access."

    if not ready:
        raise HTTPException(status_code=503, detail=out)
    return out


@api_router.get("/llm-check")
async def llm_check():
    """Quick LLM config check for debugging deployment."""
    s = _llm_status()
    hint = None
    if not s["configured"]:
        hint = f"Set {s['provider'].upper()}_API_KEY in Railway Variables. For Groq: LLM_PROVIDER=groq, GROQ_API_KEY=..."
    return {"llm": s, "hint": hint}


# ==================== LORE POOL ====================

# -- Abstraction Engine shared constants --

# Maximum character length for description/summary fields in abstracted entries
_MAX_DESC_LEN: int = 100

# Stop words shared across abstraction helpers — common English words that add
# no creative value to tag clouds or role patterns
_ABSTRACTION_STOP_WORDS: frozenset = frozenset({
    "with", "and", "the", "has", "have", "that", "from", "into", "when",
    "their", "always", "looks", "about", "which", "often", "there", "being",
    "never", "very", "this", "more", "most", "some", "them", "they",
    "wears", "wear", "drawn", "world", "universe", "cannot",
})


def _build_arc_doc_from_project(project: dict) -> dict:
    """Build a minimal arc-like dict from a Rainstorms project for abstraction."""
    return {
        "theme": project.get("theme", ""),
        "arc_type": "story arc",
        "conflict": project.get("hook", ""),
        "resolution": "",
        "tone": project.get("tone", ""),
    }


def _build_rule_doc_from_project(project: dict) -> dict:
    """Build a lore rule dict from a Rainstorms project's story_memory for abstraction."""
    memory = project.get("story_memory") or {}
    return {
        "description": memory.get("world_rules", ""),
        "rule_type": "narrative rule",
        "scope": "story",
        "consequence": memory.get("tone", ""),
    }


# -- Abstraction Engine helpers --

def _abstract_character(char: dict) -> dict:
    """
    Strip exact names, summaries, and canon references from a character
    and return an abstracted archetype pattern safe for the shared pool.
    """
    role = char.get("role", "supporting")
    personality = char.get("personality", "")
    appearance = char.get("appearance", "")
    special_trait = char.get("special_trait", "")

    # Build visual_tags from appearance keywords without exact names
    visual_keywords = [
        w.lower() for w in appearance.replace(",", " ").split()
        if len(w) > 3 and w.lower() not in {
            "with", "and", "the", "has", "have", "wears", "wear", "that", "from",
            "into", "when", "them", "their", "always", "looks", "drawn"
        }
    ]
    visual_tags = list(dict.fromkeys(visual_keywords))[:8]  # deduplicate, cap at 8

    # Map role to archetype role_type
    role_map = {
        "main": "protagonist hero",
        "supporting": "supporting companion",
        "antagonist": "antagonist / villain",
        "minor": "minor role",
    }
    role_type = role_map.get(role, role)

    # Build summary_template from personality + trait, removing names
    summary_template = ""
    if personality:
        summary_template = f"A {role_type} who is {personality[:120]}"
    if special_trait:
        summary_template += f". Special trait: {special_trait[:80]}"

    # Derive role_pattern from personality words (generalised), excluding stop words
    role_pattern = ""
    if personality:
        words = personality.lower().replace(",", " ").split()
        descriptors = [w for w in words if len(w) > 4 and w not in _ABSTRACTION_STOP_WORDS][:4]
        role_pattern = " ".join(descriptors)

    abstraction_summary = (
        f"{role_type.title()}: {personality[:_MAX_DESC_LEN]}" if personality else role_type
    )

    return {
        "archetype_name": f"{role_type.title()} Archetype",
        "category": "character",
        "role_type": role_type,
        "role_pattern": role_pattern,
        "visual_tags": visual_tags,
        "summary_template": summary_template,
        "abstraction_summary": abstraction_summary,
    }


def _abstract_faction(faction: dict) -> dict:
    """
    Abstract a faction/organisation into a reusable ideology pattern.
    Strips exact name and tied-to-canon references.
    """
    description = faction.get("description", "")
    values = faction.get("values", "")
    conflicts = faction.get("conflicts", "")
    faction_type = faction.get("faction_type", "organisation")

    tag_src = (description + " " + values).lower().replace(",", " ").split()
    theme_tags = list(dict.fromkeys(
        w for w in tag_src if len(w) > 4 and w not in _ABSTRACTION_STOP_WORDS
    ))[:8]

    ideology_pattern = description[:120] if description else faction_type
    conflict_pattern = conflicts[:_MAX_DESC_LEN] if conflicts else ""
    abstraction_summary = f"A {faction_type} characterised by: {ideology_pattern[:80]}"

    return {
        "archetype_name": f"{faction_type.title()} Pattern",
        "category": "faction",
        "role_type": faction_type,
        "ideology_pattern": ideology_pattern,
        "conflict_pattern": conflict_pattern,
        "theme_tags": theme_tags,
        "abstraction_summary": abstraction_summary,
        "summary_template": f"A faction that {ideology_pattern[:_MAX_DESC_LEN]}",
    }


def _abstract_location(location: dict) -> dict:
    """
    Abstract a location into a reusable setting pattern.
    Strips exact place names and tied-to-canon references.
    """
    description = location.get("description", "")
    atmosphere = location.get("atmosphere", "")
    location_type = location.get("location_type", "place")

    visual_keywords = [
        w.lower() for w in (description + " " + atmosphere).replace(",", " ").split()
        if len(w) > 3 and w.lower() not in _ABSTRACTION_STOP_WORDS
    ]
    visual_tags = list(dict.fromkeys(visual_keywords))[:8]

    location_pattern = f"{location_type}: {description[:_MAX_DESC_LEN]}" if description else location_type
    abstraction_summary = f"A {location_type} with: {atmosphere[:80]}" if atmosphere else location_pattern

    return {
        "archetype_name": f"{location_type.title()} Setting Pattern",
        "category": "location",
        "role_type": location_type,
        "location_pattern": location_pattern,
        "visual_tags": visual_tags,
        "abstraction_summary": abstraction_summary,
        "summary_template": f"A setting that is {description[:_MAX_DESC_LEN]}",
    }


def _abstract_story_arc(arc: dict) -> dict:
    """
    Abstract a story arc into a reusable conflict/resolution pattern.
    Strips exact titles, character names, and canon beats.
    """
    theme = arc.get("theme", "")
    arc_type = arc.get("arc_type", "story arc")
    conflict = arc.get("conflict", "")

    raw_tags = (theme + " " + arc_type).lower().replace(",", " ").split()
    theme_tags = list(dict.fromkeys(
        w for w in raw_tags if len(w) > 4 and w not in _ABSTRACTION_STOP_WORDS
    ))[:8]

    conflict_pattern = conflict[:_MAX_DESC_LEN] if conflict else ""
    abstraction_summary = (
        f"An arc about {theme[:_MAX_DESC_LEN]}" if theme else f"A {arc_type}"
    )

    return {
        "archetype_name": f"{arc_type.title()} Arc Pattern",
        "category": "arc",
        "role_type": arc_type,
        "conflict_pattern": conflict_pattern,
        "theme_tags": theme_tags,
        "abstraction_summary": abstraction_summary,
        "summary_template": f"A story arc exploring {theme[:_MAX_DESC_LEN]}",
    }


def _abstract_world_seed(world: dict) -> dict:
    """
    Abstract a world/universe seed into a reusable world-theme template.
    Strips exact universe names, canon timelines, and locked lore.
    """
    genre = world.get("genre", "")
    tone = world.get("tone", "")
    description = world.get("description", "")

    raw_tags = (genre + " " + tone + " " + description).lower().replace(",", " ").split()
    theme_tags = list(dict.fromkeys(
        w for w in raw_tags if len(w) > 4 and w not in _ABSTRACTION_STOP_WORDS
    ))[:10]

    abstraction_summary = (
        f"A {genre} world with {tone} tone: {description[:80]}" if description
        else f"A {genre} {tone} world"
    )

    return {
        "archetype_name": "World Theme Template",
        "category": "world_seed",
        "role_type": "world_seed",
        "genre": genre,
        "tone": tone,
        "theme_tags": theme_tags,
        "abstraction_summary": abstraction_summary,
        "summary_template": f"A world that is {description[:_MAX_DESC_LEN]}" if description else "",
    }


def _abstract_project(project: dict) -> dict:
    """
    Strip exact story details from a project and return an abstracted
    book-concept pattern safe for the shared pool.
    """
    tone = project.get("tone", "")
    age_range = project.get("age_range", "")
    theme = project.get("theme", "")

    # Derive theme_tags from tone and theme, no story-specific names
    raw_tags = (tone + " " + theme).lower().replace(",", " ").split()
    stop_words = {
        "the", "and", "with", "for", "that", "from", "into", "when",
        "their", "about", "between", "what", "being", "power", "learns"
    }
    theme_tags = list(dict.fromkeys(
        w for w in raw_tags if len(w) > 3 and w not in stop_words
    ))[:10]

    # Build summary_template from theme only (no title, no outline details)
    summary_template = f"A story exploring {theme[:150]}" if theme else ""
    abstraction_summary = f"A children's book concept: tone={tone}, age={age_range}, theme={theme[:80]}"

    return {
        "archetype_name": "Book Concept Archetype",
        "category": "book_concept",
        "role_type": "book_concept",
        "tone": tone,
        "age_band": age_range,
        "theme_tags": theme_tags,
        "summary_template": summary_template,
        "abstraction_summary": abstraction_summary,
    }


def _abstract_lore_rule(rule: dict) -> dict:
    """
    Abstract a lore rule / world law into a reusable world-constraint pattern.
    Strips exact universe names, franchise identifiers, and canon references.
    """
    description = rule.get("description", "")
    rule_type = rule.get("rule_type", "world rule")
    scope = rule.get("scope", "")  # e.g. "physics", "magic", "social"
    consequence = rule.get("consequence", "")

    # Combine source text, normalize, and extract meaningful tag words
    tag_source = f"{rule_type} {scope} {description}".lower().replace(",", " ")
    raw_words = tag_source.split()
    theme_tags = list(dict.fromkeys(
        w for w in raw_words if len(w) > 4 and w not in _ABSTRACTION_STOP_WORDS
    ))[:8]

    abstraction_summary = (
        f"A {scope} rule: {description[:_MAX_DESC_LEN]}" if description
        else f"A {rule_type} world constraint"
    )
    consequence_pattern = consequence[:_MAX_DESC_LEN] if consequence else ""

    return {
        "archetype_name": f"{rule_type.title()} World Constraint",
        "category": "lore_rule",
        "role_type": rule_type,
        "conflict_pattern": consequence_pattern,
        "theme_tags": theme_tags,
        "abstraction_summary": abstraction_summary,
        "summary_template": f"A world where {description[:_MAX_DESC_LEN]}" if description else "",
    }


def _run_abstraction_engine(source_type: str, source_doc: dict) -> dict:
    """
    Dispatch to the correct abstraction helper based on source_type.
    Returns a dict of abstracted fields ready to merge into a LorePoolEntry.
    """
    dispatch = {
        "character": _abstract_character,
        "book_concept": _abstract_project,
        "world_seed": _abstract_world_seed,
        "faction": _abstract_faction,
        "location": _abstract_location,
        "arc": _abstract_story_arc,
        "story_arc": _abstract_story_arc,   # explicit alias for cross-app callers
        "story_seed": _abstract_project,    # treat as book_concept
        "lore_rule": _abstract_lore_rule,
    }
    handler = dispatch.get(source_type)
    if handler is None:
        # Fallback: generic abstraction from any dict
        return {
            "archetype_name": f"{source_type.replace('_', ' ').title()} Archetype",
            "category": source_type,
            "role_type": source_type,
            "abstraction_summary": f"A {source_type} archetype",
            "summary_template": "",
        }
    return handler(source_doc)


POOL_FILTER_TAG_MAP = {
    "bedtime": ["bedtime", "sleep", "calm", "cozy", "night"],
    "funny": ["funny", "humor", "comedy", "silly", "laugh"],
    "adventure": ["adventure", "adventurous", "brave", "quest", "journey"],
    "emotional": ["emotional", "empathy", "feelings", "love", "heart"],
    "fantasy": ["fantasy", "magic", "magical", "wizard", "dragon"],
    "sibling": ["sibling", "brother", "sister", "family"],
    "animal_hero": ["animal", "dog", "cat", "rabbit", "bear", "fox", "bird"],
    "magic": ["magic", "magical", "enchanted", "spell", "wand"],
    # Extended tags
    "mystery": ["mystery", "detective", "secret", "hidden", "clue"],
    "friendship": ["friendship", "friend", "together", "bond", "trust"],
    "nature": ["nature", "forest", "ocean", "garden", "animal", "tree"],
    "sci_fi": ["robot", "space", "future", "technology", "alien"],
    "courage": ["courage", "brave", "fear", "overcome", "strength"],
}

# Genre filter values recognised for structured filtering
GENRE_VALUES = {
    "fantasy", "sci-fi", "adventure", "bedtime", "comedy", "mystery",
    "emotional", "nature", "friendship", "folklore",
}


def _entry_matches_filters(entry: dict, filters: List[str]) -> bool:
    if not filters:
        return True
    all_text = " ".join([
        " ".join(entry.get("theme_tags", [])),
        " ".join(entry.get("visual_tags", [])),
        entry.get("tone", ""),
        entry.get("role_type", ""),
        entry.get("genre", ""),
        entry.get("category", ""),
        entry.get("summary_template", ""),
        entry.get("abstraction_summary", ""),
        entry.get("ideology_pattern", ""),
        entry.get("conflict_pattern", ""),
        entry.get("location_pattern", ""),
        entry.get("role_pattern", ""),
    ]).lower()

    for f in filters:
        keywords = POOL_FILTER_TAG_MAP.get(f, [f])
        if any(kw in all_text for kw in keywords):
            return True
    return False


def _entry_matches_structured_query(
    entry: dict,
    source_type: Optional[str],
    genre: Optional[str],
    tone: Optional[str],
    age_band: Optional[str],
    theme: Optional[str],
    category: Optional[str],
    theme_tags: Optional[List[str]] = None,
) -> bool:
    """Return True if the entry matches all provided structured filter values."""
    if source_type and entry.get("source_type", "") != source_type:
        return False
    if category and entry.get("category", "").lower() != category.lower():
        return False
    if genre and genre.lower() not in entry.get("genre", "").lower():
        return False
    if tone and tone.lower() not in entry.get("tone", "").lower():
        return False
    if age_band and entry.get("age_band", "") and age_band not in entry.get("age_band", ""):
        return False
    if theme:
        theme_lc = theme.lower()
        tags_text = " ".join(entry.get("theme_tags", [])).lower()
        if theme_lc not in tags_text and theme_lc not in entry.get("abstraction_summary", "").lower():
            return False
    if theme_tags:
        # All requested theme_tags must appear somewhere in the entry's theme_tags or abstraction_summary
        entry_tags_text = " ".join(entry.get("theme_tags", [])).lower()
        entry_summary = entry.get("abstraction_summary", "").lower()
        for tag in theme_tags:
            if tag.lower() not in entry_tags_text and tag.lower() not in entry_summary:
                return False
    return True


# -- Lore Pool API endpoints --

@api_router.put("/projects/{project_id}/visibility")
async def update_project_visibility(
    project_id: str,
    body: VisibilityUpdate,
    user=Depends(require_auth),
):
    """Update the visibility of a project (private / shared_archetype / public_template)."""
    if body.visibility not in VISIBILITY_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"visibility must be one of: {sorted(VISIBILITY_OPTIONS)}"
        )
    project = await db.projects.find_one({"id": project_id, "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"visibility": body.visibility, "updated_at": datetime.utcnow()}}
    )
    return {"id": project_id, "visibility": body.visibility}


@api_router.put("/characters/{character_id}/visibility")
async def update_character_visibility(
    character_id: str,
    body: VisibilityUpdate,
    user=Depends(require_auth),
):
    """Update the visibility of a character (private / shared_archetype / public_template)."""
    if body.visibility not in VISIBILITY_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"visibility must be one of: {sorted(VISIBILITY_OPTIONS)}"
        )
    char = await db.characters.find_one({"id": character_id})
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    # Verify ownership via the project
    project = await db.projects.find_one({"id": char["project_id"], "user_id": user["user_id"]})
    if not project:
        raise HTTPException(status_code=403, detail="Not authorized to modify this character")
    await db.characters.update_one(
        {"id": character_id},
        {"$set": {"visibility": body.visibility}}
    )
    return {"id": character_id, "visibility": body.visibility}


@api_router.post("/lore-pool/share")
async def share_to_lore_pool(
    request: LorePoolShareRequest,
    user=Depends(require_auth),
):
    """
    Abstract and share a project or character into the shared Lore Pool.
    Only shared_archetype and public_template visibility values are accepted.
    Private content is NEVER accepted.
    """
    full_request = SharedLorePoolShareRequest(
        source_app="rainstorms",
        source_type=request.source_type,
        source_id=request.source_id,
        visibility=request.visibility,
    )
    return await _shared_lore_pool_share(full_request, user)


async def _shared_lore_pool_share(request: SharedLorePoolShareRequest, user: dict) -> dict:
    """Core implementation for sharing to the pool (used by both /lore-pool/share and /shared-lore-pool/share)."""
    if request.visibility not in {"shared_archetype", "public_template"}:
        raise HTTPException(
            status_code=422,
            detail="Only 'shared_archetype' or 'public_template' can be shared to the pool."
        )

    abstracted: dict = {}

    if request.source_type == "character":
        char = await db.characters.find_one({"id": request.source_id})
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")
        project = await db.projects.find_one(
            {"id": char["project_id"], "user_id": user["user_id"]}
        )
        if not project:
            raise HTTPException(status_code=403, detail="Not authorized")
        if char.get("is_locked"):
            raise HTTPException(status_code=403, detail="Character is locked and cannot be shared.")
        abstracted = _abstract_character(char)
        abstracted["tone"] = project.get("tone", "")
        abstracted["age_band"] = project.get("age_range", "")
        abstracted["theme_tags"] = []
        abstracted["universe_id"] = project.get("lore_universe_id")

    elif request.source_type in {"book_concept", "story_seed"}:
        project = await db.projects.find_one(
            {"id": request.source_id, "user_id": user["user_id"]}
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if project.get("is_locked"):
            raise HTTPException(status_code=403, detail="Project is locked and cannot be shared.")
        abstracted = _abstract_project(project)
        abstracted["visual_tags"] = []
        abstracted["universe_id"] = project.get("lore_universe_id")

    elif request.source_type in {"story_arc", "arc"}:
        project = await db.projects.find_one(
            {"id": request.source_id, "user_id": user["user_id"]}
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project (arc source) not found")
        if project.get("is_locked"):
            raise HTTPException(status_code=403, detail="Project is locked and cannot be shared.")
        abstracted = _abstract_story_arc(_build_arc_doc_from_project(project))
        abstracted["universe_id"] = project.get("lore_universe_id")

    elif request.source_type == "lore_rule":
        project = await db.projects.find_one(
            {"id": request.source_id, "user_id": user["user_id"]}
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project (lore rule source) not found")
        if project.get("is_locked"):
            raise HTTPException(status_code=403, detail="Project is locked and cannot be shared.")
        abstracted = _abstract_lore_rule(_build_rule_doc_from_project(project))
        abstracted["universe_id"] = project.get("lore_universe_id")

    else:
        raise HTTPException(
            status_code=422,
            detail=(
                f"source_type '{request.source_type}' is not supported. "
                "Supported: character, book_concept, story_seed, story_arc, arc, lore_rule."
            )
        )

    # Check for existing pool entry for this source to avoid duplicates
    existing = await db.shared_lore_pool.find_one(
        {"source_id": request.source_id, "owner_user_id": user["user_id"]}
    )
    if existing:
        update_fields = {
            "visibility": request.visibility,
            "source_app": request.source_app,
            "updated_at": datetime.utcnow(),
            **{k: v for k, v in abstracted.items() if v is not None},
        }
        await db.shared_lore_pool.update_one(
            {"id": existing["id"]},
            {"$set": update_fields}
        )
        logger.info("Updated Lore Pool entry %s for source %s", existing["id"], request.source_id)
        return {**existing, **update_fields}

    entry = LorePoolEntry(
        source_app=request.source_app,
        source_type=request.source_type,
        source_id=request.source_id,
        owner_user_id=user["user_id"],
        universe_id=abstracted.pop("universe_id", None),
        visibility=request.visibility,
        **abstracted,
    )
    await db.shared_lore_pool.insert_one(entry.dict())
    logger.info("New Lore Pool entry %s (type=%s, visibility=%s)", entry.id, request.source_type, request.visibility)
    return entry.dict()


def _sanitize_pool_doc(doc: dict) -> dict:
    """Strip private fields and serialize datetimes before returning to client."""
    doc.pop("owner_user_id", None)
    doc.pop("source_id", None)
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), datetime):
            doc[k] = doc[k].isoformat()
    return doc


@api_router.get("/lore-pool")
async def list_lore_pool(
    filters: Optional[str] = None,  # comma-separated filter tags
    limit: int = 50,
):
    """
    List Lore Pool entries that are safe to browse.
    Only shared_archetype, public_template, and demo_only entries are returned.
    Private entries are NEVER included.
    """
    filter_tags = [f.strip() for f in filters.split(",")] if filters else []
    cursor = db.shared_lore_pool.find(
        {
            "visibility": {"$in": ["shared_archetype", "public_template", "demo_only"]},
            "safety_level": "safe",
            "flag_suspected_copying": {"$ne": True},
        }
    ).sort("created_at", -1).limit(max(1, min(limit, 200)))
    docs = await cursor.to_list(max(1, min(limit, 200)))

    entries = []
    for doc in docs:
        doc = _sanitize_pool_doc(doc)
        if filter_tags and not _entry_matches_filters(doc, filter_tags):
            continue
        entries.append(doc)

    return entries


@api_router.post("/lore-pool/generate")
async def generate_from_lore_pool(
    request: LorePoolGenerateRequest,
    user=Depends(get_current_user),
):
    """
    Generate a fresh story blueprint inspired by shared Lore Pool archetypes.
    Never copies exact names, plots, or summaries.
    Combines multiple archetypes to produce an original result.
    generation_mode: story_seed | full_blueprint | fresh_recombination
    """
    # Normalise fresh_recombination alias
    mode = request.generation_mode
    if mode == "fresh_recombination":
        mode = "story_seed"
    return await _generate_from_pool(
        filter_tags=request.filters,
        tone=request.tone,
        age_range=request.age_range,
        genre=request.genre,
        page_count=request.page_count,
        count=request.count,
        generation_mode=mode,
    )


@api_router.put("/lore-pool/{entry_id}/flag")
async def flag_lore_pool_entry(
    entry_id: str,
    request: LorePoolFlagRequest,
    user=Depends(require_auth),
):
    """Update moderation flags on a Lore Pool entry (admin / self-moderation)."""
    entry = await db.shared_lore_pool.find_one({"id": entry_id})
    if not entry:
        raise HTTPException(status_code=404, detail="Lore Pool entry not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    if request.flag_suspected_copying is not None:
        updates["flag_suspected_copying"] = request.flag_suspected_copying
    if request.flag_locked_archetype is not None:
        updates["flag_locked_archetype"] = request.flag_locked_archetype
    if request.flag_admin_reviewed is not None:
        updates["flag_admin_reviewed"] = request.flag_admin_reviewed

    if updates:
        await db.shared_lore_pool.update_one({"id": entry_id}, {"$set": updates})
        logger.info("Lore Pool entry %s flagged: %s", entry_id, updates)

    return {"id": entry_id, "updated": list(k for k in updates if k != "updated_at")}


# ==================== SHARED LORE POOL (cross-app contract) ====================

async def _generate_from_pool(
    filter_tags: List[str],
    tone: Optional[str],
    age_range: Optional[str],
    genre: Optional[str],
    page_count: int,
    count: int = 1,
    generation_mode: str = "story_seed",
    structured_filters: Optional[dict] = None,
) -> dict:
    """
    Core implementation: blend shared archetypes and generate original story output.
    Used by both /lore-pool/generate and /shared-lore-pool/generate.
    """
    import random

    # Fetch eligible pool entries
    cursor = db.shared_lore_pool.find(
        {
            "visibility": {"$in": ["shared_archetype", "public_template", "demo_only"]},
            "safety_level": "safe",
            "flag_suspected_copying": {"$ne": True},
        }
    ).limit(200)
    all_entries = await cursor.to_list(200)

    # Apply tag filters
    if filter_tags:
        pool = [e for e in all_entries if _entry_matches_filters(e, filter_tags)]
    else:
        pool = all_entries

    # Apply structured filters if provided
    if structured_filters:
        theme_tags_filter = structured_filters.get("theme_tags")
        if isinstance(theme_tags_filter, str):
            theme_tags_filter = [t.strip() for t in theme_tags_filter.split(",") if t.strip()]
        pool = [
            e for e in pool
            if _entry_matches_structured_query(
                e,
                source_type=structured_filters.get("source_type"),
                genre=structured_filters.get("genre") or genre,
                tone=structured_filters.get("tone") or tone,
                age_band=structured_filters.get("age_band") or age_range,
                theme=structured_filters.get("theme"),
                category=structured_filters.get("category"),
                theme_tags=theme_tags_filter or None,
            )
        ]
    elif genre or tone:
        pool = [
            e for e in pool
            if _entry_matches_structured_query(
                e, source_type=None, genre=genre, tone=tone,
                age_band=age_range, theme=None, category=None
            )
        ]

    if not pool:
        raise HTTPException(
            status_code=404,
            detail="No shared archetypes found matching your filters. Try different filters or add more archetypes to the pool."
        )

    # Pick up to 5 entries to blend
    selected = random.sample(pool, min(5, len(pool)))

    # Build an inspiration block (no exact names or private details)
    archetype_lines = []
    for e in selected:
        parts = []
        if e.get("category"):
            parts.append(f"category: {e['category']}")
        if e.get("role_type"):
            parts.append(f"role: {e['role_type']}")
        if e.get("role_pattern"):
            parts.append(f"pattern: {e['role_pattern']}")
        if e.get("ideology_pattern"):
            parts.append(f"ideology: {e['ideology_pattern'][:60]}")
        if e.get("conflict_pattern"):
            parts.append(f"conflict: {e['conflict_pattern'][:60]}")
        if e.get("location_pattern"):
            parts.append(f"setting: {e['location_pattern'][:60]}")
        if e.get("tone"):
            parts.append(f"tone: {e['tone']}")
        if e.get("genre"):
            parts.append(f"genre: {e['genre']}")
        if e.get("age_band"):
            parts.append(f"age band: {e['age_band']}")
        if e.get("theme_tags"):
            parts.append(f"themes: {', '.join(e['theme_tags'][:5])}")
        if e.get("visual_tags"):
            parts.append(f"visuals: {', '.join(e['visual_tags'][:4])}")
        if e.get("abstraction_summary"):
            parts.append(f"summary: {e['abstraction_summary'][:80]}")
        archetype_lines.append(" | ".join(parts))

    inspiration_block = "\n".join(f"- {line}" for line in archetype_lines)
    resolved_tone = tone or selected[0].get("tone", "cozy")
    resolved_age = age_range or selected[0].get("age_band", "4-6")
    resolved_genre = genre or selected[0].get("genre", "")

    logger.info(
        "Generating from Shared Lore Pool: %d archetypes selected, filters=%s, mode=%s",
        len(selected), filter_tags, generation_mode
    )

    system_msg = (
        "You are a creative children's book author. "
        "You generate ORIGINAL stories inspired by creative patterns and archetypes. "
        "You NEVER copy exact character names, plot lines, or stories. "
        "You remix, recombine, and invent fresh new stories. "
        "Always respond with valid JSON only."
    )

    if generation_mode in ("story_seed", "fresh_recombination"):
        prompt = f"""You are given creative archetype patterns from a shared inspiration pool.
Generate {count} COMPLETELY ORIGINAL children's story seed(s) inspired by these patterns.
Do NOT copy any names, settings, or exact beats — invent everything fresh.

INSPIRATION PATTERNS (archetypes only — remix freely):
{inspiration_block}

TARGET TONE: {resolved_tone}
{'GENRE: ' + resolved_genre if resolved_genre else ''}
AGE RANGE: {resolved_age} years

Rules:
- Rename ALL characters (no copying archetype names)
- Create a fresh setting
- Build an original premise
- Keep tone and age appropriateness consistent
- Each seed must be distinct

Respond with JSON:
{{
  "results": [
    {{
      "title": "...",
      "hook": "...",
      "theme": "...",
      "tone": "...",
      "hero_archetype": "...",
      "story_premise": "...",
      "inspiration_tags": ["...", "..."]
    }}
  ]
}}
"""
    else:
        prompt = f"""You are given creative archetype patterns from a shared inspiration pool.
Generate a COMPLETELY ORIGINAL children's picture book concept inspired by these patterns.
Do NOT copy any names or exact story beats — invent everything fresh.

INSPIRATION PATTERNS (archetypes only — remix freely):
{inspiration_block}

TARGET TONE: {resolved_tone}
{'GENRE: ' + resolved_genre if resolved_genre else ''}
AGE RANGE: {resolved_age} years
PAGE COUNT: {page_count}

Rules:
- Rename ALL characters (no copying archetype names)
- Create a fresh setting
- Build an original plot
- Keep tone and age appropriateness consistent

Respond with JSON:
{{
  "title": "...",
  "hook": "...",
  "summary": "...",
  "theme": "...",
  "characters": [
    {{"name": "...", "role": "main", "personality": "...", "appearance": "...", "special_trait": "..."}}
  ],
  "outline": ["Page 1: ...", "Page 2: ...", ...]
}}
"""

    response = await _llm_chat(system_msg, prompt)
    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        result = json.loads(cleaned.strip())
    except Exception as exc:
        logger.error("Shared Lore Pool generation JSON parse error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate from Lore Pool. Please try again.")

    result["_generated_from_pool"] = True
    result["_archetype_count"] = len(selected)
    logger.info("Shared Lore Pool generation complete, mode=%s", generation_mode)
    return result


@api_router.get("/shared-lore-pool")
async def list_shared_lore_pool(
    source_type: Optional[str] = None,
    source_app: Optional[str] = None,
    genre: Optional[str] = None,
    tone: Optional[str] = None,
    age_band: Optional[str] = None,
    theme: Optional[str] = None,
    theme_tags: Optional[str] = None,   # comma-separated, e.g. "bedtime,siblings"
    category: Optional[str] = None,
    limit: int = 50,
):
    """
    GET /api/shared-lore-pool — list shared archetypes with structured query params.
    Only shared_archetype / public_template / demo_only entries are returned.
    owner_user_id and source_id are NEVER exposed.

    Query params:
      source_type, source_app, genre, tone, age_band, theme, theme_tags (csv), category
    """
    # Parse theme_tags csv into a list
    theme_tags_list: Optional[List[str]] = (
        [t.strip() for t in theme_tags.split(",") if t.strip()] if theme_tags else None
    )

    cursor = db.shared_lore_pool.find(
        {
            "visibility": {"$in": ["shared_archetype", "public_template", "demo_only"]},
            "safety_level": "safe",
            "flag_suspected_copying": {"$ne": True},
        }
    ).sort("created_at", -1).limit(max(1, min(limit, 200)))
    docs = await cursor.to_list(max(1, min(limit, 200)))

    entries = []
    for doc in docs:
        # source_app filter (exact match)
        if source_app and doc.get("source_app", "") != source_app:
            continue
        if not _entry_matches_structured_query(
            doc,
            source_type=source_type,
            genre=genre,
            tone=tone,
            age_band=age_band,
            theme=theme,
            category=category,
            theme_tags=theme_tags_list,
        ):
            continue
        entries.append(_sanitize_pool_doc(doc))

    return entries


@api_router.get("/shared-lore-pool/{entry_id}")
async def get_shared_lore_pool_entry(entry_id: str):
    """
    GET /api/shared-lore-pool/{id} — return a single safe pool entry.
    Private entries and flagged entries are rejected.
    owner_user_id and source_id are NEVER exposed.
    """
    doc = await db.shared_lore_pool.find_one({"id": entry_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lore Pool entry not found")
    if doc.get("visibility") == "private":
        raise HTTPException(status_code=403, detail="This entry is private")
    if doc.get("flag_suspected_copying") or doc.get("safety_level") != "safe":
        raise HTTPException(status_code=403, detail="This entry is not available")
    return _sanitize_pool_doc(doc)


@api_router.post("/shared-lore-pool/extract")
async def extract_to_shared_lore_pool(
    request: SharedLorePoolExtractRequest,
    user=Depends(require_auth),
):
    """
    POST /api/shared-lore-pool/extract — abstract a source document into a safe pool entry.
    This does NOT save the entry (preview only). Use /share to persist.
    The source_app may be 'rainstorms' or 'sagaarch'.
    """
    source_doc: dict = {}

    if request.source_app == "rainstorms":
        if request.source_type == "character":
            char = await db.characters.find_one({"id": request.source_id})
            if not char:
                raise HTTPException(status_code=404, detail="Character not found")
            project = await db.projects.find_one(
                {"id": char["project_id"], "user_id": user["user_id"]}
            )
            if not project:
                raise HTTPException(status_code=403, detail="Not authorized")
            if char.get("is_locked"):
                raise HTTPException(status_code=403, detail="Character is locked")
            source_doc = {**char, "tone": project.get("tone", ""), "age_range": project.get("age_range", "")}
        elif request.source_type in {"book_concept", "story_seed"}:
            project = await db.projects.find_one(
                {"id": request.source_id, "user_id": user["user_id"]}
            )
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            if project.get("is_locked"):
                raise HTTPException(status_code=403, detail="Project is locked")
            source_doc = project
        elif request.source_type in {"story_arc", "arc"}:
            # Story arcs live on the story_memory of a project in Rainstorms
            project = await db.projects.find_one(
                {"id": request.source_id, "user_id": user["user_id"]}
            )
            if not project:
                raise HTTPException(status_code=404, detail="Project (arc source) not found")
            if project.get("is_locked"):
                raise HTTPException(status_code=403, detail="Project is locked")
            source_doc = _build_arc_doc_from_project(project)
        elif request.source_type == "lore_rule":
            # For Rainstorms, lore rules are stored in the story memory block
            project = await db.projects.find_one(
                {"id": request.source_id, "user_id": user["user_id"]}
            )
            if not project:
                raise HTTPException(status_code=404, detail="Project (lore rule source) not found")
            if project.get("is_locked"):
                raise HTTPException(status_code=403, detail="Project is locked")
            source_doc = _build_rule_doc_from_project(project)
        else:
            raise HTTPException(
                status_code=422,
                detail=f"source_type '{request.source_type}' not supported for Rainstorms extraction."
            )
    else:
        # SagaARCH or other cross-app extraction: the caller provides the document
        # in the source_id field as a JSON reference. We cannot fetch it directly;
        # the cross-app POST /shared-lore-pool/share is the correct flow.
        raise HTTPException(
            status_code=422,
            detail=(
                "Cross-app extraction (source_app='sagaarch') is handled via "
                "POST /api/shared-lore-pool/share with pre-abstracted fields."
            )
        )

    abstracted = _run_abstraction_engine(request.source_type, source_doc)
    abstracted["source_type"] = request.source_type
    abstracted["source_app"] = request.source_app
    logger.info(
        "Abstraction preview for %s/%s: archetype=%s",
        request.source_app, request.source_type, abstracted.get("archetype_name")
    )
    return abstracted


@api_router.post("/shared-lore-pool/generate")
async def generate_from_shared_lore_pool(
    request: SharedLorePoolGenerateRequest,
    user=Depends(get_current_user),
):
    """
    POST /api/shared-lore-pool/generate — generate original story seeds from the shared pool.
    Accepts structured filters dict: {tone, age_band, genre, theme_tags (list), category, source_type}.
    generation_mode: fresh_recombination | story_seed | full_blueprint
    """
    filters_dict = request.filters or {}

    # Collect tag-based filter chips from non-structured keys and list values
    STRUCTURED_KEYS = {"tone", "age_band", "genre", "theme", "theme_tags", "category", "source_type"}
    filter_tags: List[str] = []
    for k, v in filters_dict.items():
        if k in STRUCTURED_KEYS:
            continue
        if isinstance(v, list):
            filter_tags.extend(str(tag) for tag in v if tag)
        elif v:
            filter_tags.append(str(v))

    # theme_tags list → add to filter_tags too
    theme_tags_from_filter = filters_dict.get("theme_tags", [])
    if isinstance(theme_tags_from_filter, list):
        filter_tags.extend(str(t) for t in theme_tags_from_filter if t)
    elif theme_tags_from_filter:
        filter_tags.append(str(theme_tags_from_filter))

    # Normalise generation mode: fresh_recombination is an alias for story_seed
    mode = request.generation_mode
    if mode == "fresh_recombination":
        mode = "story_seed"

    raw = await _generate_from_pool(
        filter_tags=filter_tags,
        tone=filters_dict.get("tone"),
        age_range=filters_dict.get("age_band"),
        genre=filters_dict.get("genre"),
        page_count=10,
        count=max(1, min(request.count, 5)),
        generation_mode=mode,
        structured_filters=filters_dict,
    )

    # Normalise response: always wrap in {"results": [...]} format per contract
    if "seeds" in raw:
        results = raw["seeds"]
    elif "title" in raw:
        # full blueprint — wrap as single-item results list
        results = [raw]
    else:
        results = raw.get("results", [raw])

    return {
        "results": results,
        "_generated_from_pool": True,
        "_archetype_count": raw.get("_archetype_count", 0),
    }


@api_router.post("/shared-lore-pool/share")
async def share_to_shared_lore_pool(
    request: SharedLorePoolShareRequest,
    user=Depends(require_auth),
):
    """
    POST /api/shared-lore-pool/share — share content from any supported app to the shared pool.
    For SagaARCH content the entry should already be abstracted by the caller;
    for Rainstorms content we run the abstraction engine here.
    """
    return await _shared_lore_pool_share(request, user)


# ==================== SMART COVER GENERATOR ====================

async def _build_cover_concept(project: dict, characters: List[dict]) -> str:
    """
    Use the LLM to generate a vivid visual concept for the front cover illustration.
    Returns a short descriptive paragraph suitable for feeding into a DALL-E prompt.
    """
    title = project.get("title", "Untitled")
    theme = project.get("theme", "")
    tone = project.get("tone", "")
    summary = project.get("summary", "")
    # Pick up to 2 main characters
    char_lines = []
    for ch in characters[:2]:
        name = ch.get("name", "")
        desc = ch.get("description", "")
        appearance = ch.get("color_palette", "") or ch.get("clothing", "") or ch.get("unique_traits", "")
        if name:
            char_lines.append(f"- {name}: {desc[:80]}" + (f" ({appearance[:60]})" if appearance else ""))
    char_block = "\n".join(char_lines) if char_lines else "(no named characters yet)"

    prompt = (
        f"You are an art director for a children's picture book.\n\n"
        f"Book title: {title}\n"
        f"Theme: {theme}\n"
        f"Tone: {tone}\n"
        f"Story summary: {summary[:300]}\n"
        f"Main characters:\n{char_block}\n\n"
        f"Write a single short paragraph (3-4 sentences) describing the COVER ILLUSTRATION scene. "
        f"Be specific about:\n"
        f"- who is shown on the cover\n"
        f"- what they are doing\n"
        f"- the setting and lighting\n"
        f"- the emotional feel\n"
        f"Do NOT include any title text in the description. Keep it visual and evocative."
    )

    try:
        response = await _llm_chat("You are an art director for a children's picture book.", prompt)
        return response.strip()
    except Exception as exc:
        logger.error("Cover concept generation failed: %s", exc)
        # Fallback: craft a basic concept from available metadata
        char_name = characters[0].get("name", "the hero") if characters else "the hero"
        return (
            f"{char_name} stands in the center of the scene, bathed in warm golden light. "
            f"The background shows {theme or 'a magical storybook world'} with rich, inviting colors. "
            f"The mood is {tone or 'cozy and adventurous'}, perfectly suited to a children's picture book cover."
        )


async def _build_back_cover_blurb(project: dict) -> str:
    """
    Generate a compelling back-cover blurb using the LLM.
    """
    title = project.get("title", "Untitled")
    summary = project.get("summary", "")
    tone = project.get("tone", "")
    hook = project.get("hook", "")

    prompt = (
        f"Write a short, engaging back-cover blurb for a children's picture book.\n\n"
        f"Title: {title}\n"
        f"Hook: {hook}\n"
        f"Summary: {summary[:400]}\n"
        f"Tone: {tone}\n\n"
        f"Rules:\n"
        f"- 3-4 short sentences maximum\n"
        f"- Use simple, evocative language for children and parents\n"
        f"- End with a sense of wonder or excitement\n"
        f"- Do NOT include the title in the blurb text itself\n"
        f"Return only the blurb text, no labels or headers."
    )

    try:
        response = await _llm_chat("You are a children's book copywriter.", prompt)
        return response.strip()
    except Exception as exc:
        logger.error("Back blurb generation failed: %s", exc)
        return summary[:300] if summary else "A magical story for young dreamers everywhere."


async def _generate_cover_image(prompt: str, project_id: str, filename: str) -> str:
    """
    Generate a cover image using DALL-E 3 and save to static/covers/{project_id}/.
    Returns the relative URL path or empty string on failure.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping cover image generation")
        return ""

    try:
        async with httpx.AsyncClient(timeout=90.0) as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt[:4096],
                    "n": 1,
                    "size": "1024x1024",
                    "response_format": "b64_json",
                    "quality": "hd",  # HD quality for the cover
                },
            )
        response.raise_for_status()
        data = response.json()
        image_b64 = data["data"][0]["b64_json"]
    except httpx.HTTPStatusError as exc:
        logger.error("Cover image HTTP error %s: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Cover image generation failed: %s", exc)
        return ""

    cover_dir = COVERS_DIR / project_id
    cover_dir.mkdir(parents=True, exist_ok=True)
    image_path = cover_dir / filename

    image_bytes = base64.b64decode(image_b64)
    image_path.write_bytes(image_bytes)
    logger.info("Cover image saved: %s (%d bytes)", image_path, len(image_bytes))
    return f"/static/covers/{project_id}/{filename}"


@api_router.get("/cover-styles")
async def get_cover_styles():
    """
    GET /api/cover-styles
    Return available cover style presets.
    """
    return {
        "styles": [
            {"key": k, **{field: v[field] for field in ("label", "emoji", "description")}}
            for k, v in COVER_STYLES.items()
        ],
        "default": DEFAULT_COVER_STYLE,
    }


@api_router.post("/projects/{project_id}/cover/generate")
async def generate_cover(
    project_id: str,
    body: CoverGenerateRequest = CoverGenerateRequest(),
    user=Depends(get_current_user),
):
    """
    POST /api/projects/{project_id}/cover/generate
    Full cover generation pipeline:
      1. Load project + characters
      2. Generate cover concept via LLM
      3. Generate front-cover illustration via DALL-E 3
      4. Generate back-cover blurb via LLM
      5. Persist cover data on project
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    characters = await db.characters.find({"project_id": project_id}).to_list(20)

    cover_style_key = body.cover_style or project.get("cover", {}).get("cover_style", DEFAULT_COVER_STYLE)
    if cover_style_key not in COVER_STYLES:
        cover_style_key = DEFAULT_COVER_STYLE
    style_info = COVER_STYLES[cover_style_key]

    # Step 1 — concept
    concept = await _build_cover_concept(project, characters)

    # Step 2 — build DALL-E prompt
    title = project.get("title", "Untitled")
    dalle_prompt = (
        f"Children's picture book FRONT COVER illustration. "
        f"NO text, title, or words on the image — illustration only.\n\n"
        f"Scene: {concept}\n\n"
        f"{style_info['prompt_suffix']}. "
        f"High quality, 300 DPI equivalent, storybook illustration, "
        f"professional children's book cover art."
    )

    # Step 3 — generate front cover image
    front_cover_url = await _generate_cover_image(dalle_prompt, project_id, "front_cover.png")

    # Step 4 — back cover blurb
    back_blurb = await _build_back_cover_blurb(project)

    # Step 5 — determine author name
    meta = project.get("publishing_metadata") or {}
    author_name = (
        body.author_name
        or meta.get("author_name")
        or meta.get("pen_name")
        or ""
    )

    cover_data = CoverData(
        cover_style=cover_style_key,
        concept=concept,
        front_cover_url=front_cover_url,
        back_blurb=back_blurb,
        author_name=author_name,
        tagline=body.tagline or "",
        generated_at=datetime.utcnow().isoformat(),
    )

    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"cover": cover_data.dict(), "updated_at": datetime.utcnow()}},
    )
    logger.info("Cover generated for project %s (style=%s)", project_id, cover_style_key)
    return {"project_id": project_id, "cover": cover_data.dict()}


@api_router.put("/projects/{project_id}/cover")
async def update_cover(
    project_id: str,
    body: CoverUpdateRequest,
    user=Depends(get_current_user),
):
    """
    PUT /api/projects/{project_id}/cover
    Manually update cover metadata (style, author, tagline, blurb) without re-generating.
    """
    project = await db.projects.find_one({"id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    current_cover: dict = dict(project.get("cover") or {})

    if body.cover_style is not None:
        if body.cover_style not in COVER_STYLES:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown cover_style '{body.cover_style}'. Valid: {list(COVER_STYLES.keys())}",
            )
        current_cover["cover_style"] = body.cover_style
    if body.author_name is not None:
        current_cover["author_name"] = body.author_name
    if body.tagline is not None:
        current_cover["tagline"] = body.tagline
    if body.back_blurb is not None:
        current_cover["back_blurb"] = body.back_blurb

    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"cover": current_cover, "updated_at": datetime.utcnow()}},
    )
    return {"project_id": project_id, "cover": current_cover}


# Include the router in the main app
app.include_router(api_router)
app.include_router(lore_router)
app.include_router(meta_router)

# CORS: "*" for dev; set CORS_ORIGINS (comma-separated) in production to restrict
_cors_origins = os.environ.get("CORS_ORIGINS", "").strip()
CORS_ORIGINS_LIST = [o.strip() for o in _cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS_LIST if CORS_ORIGINS_LIST else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
