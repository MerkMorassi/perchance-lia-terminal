import json
import random
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="MythOS Scribe: Thematic Engine")

# --- DATA INGESTION ---
def load_json(filename):
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

# Load databases
THEMES_DB = load_json("novel_themes.json")
STRUCTURES_DB = load_json("structures.json")
ARCHETYPES_DB = load_json("archetypes.json")

# --- MODELS ---
class ScribeRequest(BaseModel):
    theme_id: str          # e.g., "digital_extinction"
    structure_id: str      # e.g., "vogler_12"

# --- THE LOGIC ENGINE ---
@app.post("/generate_blueprint")
def generate_blueprint(req: ScribeRequest):
    # 1. VALIDATE INPUTS
    if req.theme_id not in THEMES_DB.get("core_themes", {}):
        raise HTTPException(404, "Theme not found. Check /config for options.")
    
    theme_data = THEMES_DB["core_themes"][req.theme_id]
    structure_data = STRUCTURES_DB.get(req.structure_id, {})

    # 2. SELECT COMPATIBLE ELEMENTS
    compat = theme_data.get("compatible_elements", {})
    selected_philosophy = random.choice(compat.get("philosophies", ["Unknown Philosophy"]))
    selected_setting = random.choice(compat.get("settings", ["Unknown Void"]))
    
    # 3. CASTING
    cast_list = []
    theme_characters = compat.get("characters", [])
    for char_role in theme_characters[:2]: 
        cast_list.append(f"ROLE: {char_role.upper()} | MOTIVATION: Driven by {selected_philosophy}")

    # 4. CONSTRUCT BEATS
    core_question = random.choice(theme_data.get("philosophies", {}).get("core_questions", ["What is reality?"]))
    
    script_outline = f"TITLE: {req.theme_id.upper().replace('_', ' ')}\n"
    script_outline += f"THEME: {core_question}\n"
    script_outline += f"SETTING: {selected_setting}\n"
    script_outline += f"TONE: {theme_data.get('tags', [])}\n\n"
    script_outline += "=== CAST ===\n" + "\n".join(cast_list) + "\n\n"
    script_outline += "=== BEAT SHEET ===\n"
    
    beats = structure_data.get("beats", [])
    for beat in beats:
        script_outline += f"\n## {beat['label'].upper()}\n"
        if "Call" in beat['label'] or "Catalyst" in beat['label']:
            hooks = THEMES_DB.get("narrative_hooks", {}).get("identity_crisis", [])
            hook = random.choice(hooks) if hooks else "A glitch occurs."
            script_outline += f"ACTION: The Protagonist {hook}\n"
        else:
            script_outline += f"ACTION: {beat['instruction']}\n"

    return {"status": "success", "blueprint": script_outline}

@app.get("/config")
def get_config():
    return {
        "themes": list(THEMES_DB.get("core_themes", {}).keys()),
        "structures": list(STRUCTURES_DB.keys())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)