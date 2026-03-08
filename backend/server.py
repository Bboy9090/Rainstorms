from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
import json
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from emergentintegrations.llm.chat import LlmChat, UserMessage
from lore_engine import lore_router, meta_router, init_lore_engine

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'rainstorms_db')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'rainstorms_secret_key_2024_v1')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Initialise LoreEngine with database and LLM key
init_lore_engine(db, EMERGENT_LLM_KEY)

# Create the main app
app = FastAPI(title="Rainstorms API", version="1.0.0")

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
    visual_tags: Optional[dict] = None  # For visual consistency in illustrations
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CharacterCreate(BaseModel):
    name: str
    role: str
    personality: str
    appearance: str
    special_trait: str
    notes: str = ""
    visual_tags: Optional[dict] = None

class PageData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    page_number: int
    outline_beat: str
    page_text: str = ""
    illustration_prompt: str = ""
    emotional_beat: str = ""
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
    is_demo: bool = False
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
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"paths-{uuid.uuid4()}",
        system_message="""You are a children's book story developer.
Create engaging, distinct story directions for young readers.
Always respond with valid JSON only."""
    ).with_model("openai", "gpt-4.1")

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

    response = await chat.send_message(UserMessage(text=prompt))
    
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
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"storytime-{uuid.uuid4()}",
        system_message="""You are a children's storytelling coach.
Create engaging narrator scripts with voice directions for parents reading to children.
Always respond with valid JSON only."""
    ).with_model("openai", "gpt-4.1")

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

    response = await chat.send_message(UserMessage(text=prompt))
    
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

async def generate_blueprint(idea: str, tone: str, age_range: str, page_count: int, lesson: str = None, legacy_character: dict = None, lore_context: dict = None) -> dict:
    """Generate story blueprint using AI"""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"blueprint-{uuid.uuid4()}",
        system_message="""You are a children's book author and story development expert. 
You create engaging, age-appropriate stories for picture books.
Always respond with valid JSON only, no additional text."""
    ).with_model("openai", "gpt-4.1")

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

    response = await chat.send_message(UserMessage(text=prompt))
    
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
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"characters-{uuid.uuid4()}",
        system_message="""You are a children's book character designer.
Create vivid, memorable characters with distinct visual appearances.
Always respond with valid JSON only."""
    ).with_model("openai", "gpt-4.1")

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

    response = await chat.send_message(UserMessage(text=prompt))
    
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
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"page-{uuid.uuid4()}",
        system_message="""You are a children's picture book author.
Write engaging, age-appropriate text for picture book pages.
Keep text concise - typically 2-5 sentences per page.
Always respond with valid JSON only."""
    ).with_model("openai", "gpt-4.1")

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

    response = await chat.send_message(UserMessage(text=prompt))
    
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
    """Generate illustration prompt for a page"""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"illustration-{uuid.uuid4()}",
        system_message="""You are a children's book art director.
Create detailed illustration prompts that capture the essence of each page.
Focus on composition, mood, and character consistency."""
    ).with_model("openai", "gpt-4.1")

    character_info = "\n".join([f"- {c['name']}: {c['appearance']}" for c in characters])
    
    prompt = f"""Create an illustration prompt for page {page_number}:

TITLE: {project.get('title', '')}
TONE: {project.get('tone', '')}
PAGE TEXT: {page_text}

CHARACTERS TO POTENTIALLY INCLUDE:
{character_info}

Create a detailed illustration prompt. Include:
1. Scene description and setting
2. Characters present and their poses/expressions
3. Key visual elements and props
4. Mood and lighting
5. Composition suggestions

End with this style note:
"Style: soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"

Return ONLY the illustration prompt text, nothing else."""

    response = await chat.send_message(UserMessage(text=prompt))
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
        universe = await db.lore_universes.find_one({"id": request.lore_universe_id})
        if not universe:
            raise HTTPException(
                status_code=404,
                detail=f"Universe '{request.lore_universe_id}' not found. Sync it from SagaArchitect first."
            )
        characters = await db.lore_characters.find(
            {"universe_id": request.lore_universe_id, "canon_status": "canon"}
        ).to_list(20)
        factions = await db.lore_factions.find(
            {"universe_id": request.lore_universe_id, "canon_status": "canon"}
        ).to_list(20)
        locations = await db.lore_locations.find(
            {"universe_id": request.lore_universe_id, "canon_status": "canon"}
        ).to_list(20)
        rules = await db.lore_rules.find(
            {"universe_id": request.lore_universe_id, "canon_status": "canon"}
        ).to_list(20)
        events = await db.lore_timeline_events.find(
            {"universe_id": request.lore_universe_id, "canon_status": "canon"}
        ).sort("era_marker", 1).to_list(10)

        lore_context = {
            "universe_name": universe["name"],
            "universe_tone": universe.get("tone", ""),
            "world_overview": universe.get("world_overview", ""),
            "current_conflict": universe.get("current_conflict", ""),
            "world_rules": [
                {"rule_type": r.get("rule_type", ""), "rule": r["rule"], "consequence": r.get("consequence", "")}
                for r in rules
            ],
            "relevant_characters": [
                {"name": c["name"], "role": c.get("role", ""), "appearance": c.get("appearance", ""), "status": c.get("status", "alive")}
                for c in characters
            ],
            "relevant_factions": [
                {"name": f["name"], "ideology": f.get("ideology", ""), "territory": f.get("territory", "")}
                for f in factions
            ],
            "relevant_locations": [
                {"name": l["name"], "type": l.get("type", ""), "description": l.get("description", "")}
                for l in locations
            ],
            "timeline_context": [
                {"era": e.get("era_marker", ""), "title": e["title"], "summary": e.get("summary", "")}
                for e in events
            ],
        }

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
    char_list = [{"name": c["name"], "appearance": c["appearance"]} for c in characters]
    
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
    """Generate illustration prompt for a page"""
    project = await db.projects.find_one({"id": request.project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    characters = await db.characters.find({"project_id": request.project_id}).to_list(20)
    char_list = [{"name": c["name"], "appearance": c["appearance"]} for c in characters]
    
    prompt = await generate_illustration_prompt(project, char_list, request.page_number, request.page_text)
    
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
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"title-{uuid.uuid4()}",
        system_message="You are a creative children's book title generator."
    ).with_model("openai", "gpt-4.1")
    
    prompt = f"""Generate a new creative title for this children's book:
STORY IDEA: {project['original_idea']}
SUMMARY: {project.get('summary', '')}
TONE: {project['tone']}

Return ONLY the title text, nothing else."""
    
    response = await chat.send_message(UserMessage(text=prompt))
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
    
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"improve-{uuid.uuid4()}",
        system_message=f"""You are a children's picture book editor. You help writers refine their text.
Keep text concise - picture books have brief text per page.
{memory_context}"""
    ).with_model("openai", "gpt-4.1")
    
    prompt = f"""Improve this children's book page text:

ORIGINAL TEXT:
{request.page_text}

STORY CONTEXT:
Title: {project['title']}
Tone: {project['tone']}
Age range: {project['age_range']}

INSTRUCTION: {instruction}

Return ONLY the improved text, nothing else. Keep it brief (2-5 sentences) as this is for a picture book page."""

    response = await chat.send_message(UserMessage(text=prompt))
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
        notes=char_data.notes
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
        is_demo=True
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
            notes="Draw him slightly small compared to furniture to emphasize his bravery despite being little"
        ),
        Character(
            project_id=demo_project.id,
            name="Baby Max",
            role="supporting",
            personality="Sweet, innocent, and peaceful. Giggles easily and always reaches for Oliver when he sees him.",
            appearance="A chubby 10-month-old baby with wispy blonde hair and big blue eyes. Wears a soft yellow onesie with a duck on it. Always has a peaceful, content expression.",
            special_trait="His innocent smile can light up any dark room",
            notes="Keep him looking cozy and protected in his crib throughout"
        ),
        Character(
            project_id=demo_project.id,
            name="Shadow Monsters",
            role="minor",
            personality="Mischievous but not truly evil—they're more like naughty fears that scatter when confronted with love.",
            appearance="Wispy, purple-gray shapes with big cartoonish yellow eyes. They look more silly than scary, like smoke puppets. They have no defined shape, constantly shifting.",
            special_trait="They shrink when exposed to light or love",
            notes="Keep them non-threatening for young readers—more playful spooky than scary"
        ),
        Character(
            project_id=demo_project.id,
            name="The Nightmare King",
            role="minor",
            personality="Dramatic and pompous but ultimately powerless against love. More bark than bite.",
            appearance="A larger shadow figure wearing a crooked crown made of darkness. Has an exaggerated frown and arms that wave dramatically. Looks like a grumpy cloud.",
            special_trait="Melts into harmless starlight when defeated",
            notes="Make him look huffily defeated rather than scary when he loses"
        )
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

# Include the router in the main app
app.include_router(api_router)
app.include_router(lore_router)
app.include_router(meta_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
