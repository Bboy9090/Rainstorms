import sys
import re

def patch_server():
    with open('server.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove OPENAI_API_KEY guards in endpoints
    content = re.sub(
        r'    if not OPENAI_API_KEY:\s+raise HTTPException\(\s+status_code=503,\s+detail="Image generation is not available. Set OPENAI_API_KEY in the backend \.env file\.",\s+\)',
        '',
        content, count=1
    )
    content = re.sub(
        r'    if not OPENAI_API_KEY:\s+raise HTTPException\(\s+status_code=503,\s+detail=\(\s+"Image generation is not available\. "\s+"Set OPENAI_API_KEY in the backend \.env file to enable this feature\."\s+\)\s+\)',
        '',
        content, count=1
    )
    
    # 2. Update error message in generate_page_illustration
    content = content.replace(
        '"Image generation is not available. "\n                "Set OPENAI_API_KEY in the backend .env file to enable this feature."',
        '"Image generation failed. Try again."'
    )

    # 3. Patch _generate_reference_sheet_image
    old_sheet = """    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping reference sheet generation")
        return ""

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
                    "response_format": "b64_json"
                },
            )
        response.raise_for_status()
        data = response.json()
        image_b64 = data["data"][0]["b64_json"]

    except Exception as exc:
        logger.error("Reference sheet generation failed: %s", exc)
        return ""

    # Save image to local static directory
    char_dir = ILLUSTRATIONS_DIR / char["project_id"]
    char_dir.mkdir(parents=True, exist_ok=True)
    image_path = char_dir / "reference_sheet.png"

    image_bytes = base64.b64decode(image_b64)
    image_path.write_bytes(image_bytes)"""
    
    new_sheet = """    image_bytes = None
    try:
        import urllib.parse
        if OPENAI_API_KEY:
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
                        "response_format": "b64_json"
                    },
                )
            response.raise_for_status()
            image_b64 = response.json()["data"][0]["b64_json"]
            image_bytes = base64.b64decode(image_b64)
        else:
            logger.info("Using free Pollinations API for reference sheet generation")
            encoded_prompt = urllib.parse.quote(prompt[:1000])
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                response = await http_client.get(url)
            response.raise_for_status()
            image_bytes = response.content
            
    except Exception as exc:
        logger.error("Reference sheet generation failed: %s", exc)
        return ""

    # Save image to local static directory
    char_dir = ILLUSTRATIONS_DIR / char["project_id"]
    char_dir.mkdir(parents=True, exist_ok=True)
    image_path = char_dir / "reference_sheet.png"
    image_path.write_bytes(image_bytes)"""

    content = content.replace(old_sheet, new_sheet)

    # 4. Patch _generate_illustration_image
    old_ill = """    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping image generation")
        return ""

    # Append the style suffix to the prompt
    style = STYLE_PRESETS.get(style_preset, STYLE_PRESETS[DEFAULT_STYLE_PRESET])
    full_prompt = f"{prompt}\\n\\n{style['suffix']}"

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
    image_path.write_bytes(image_bytes)"""

    new_ill = """    # Append the style suffix to the prompt
    style = STYLE_PRESETS.get(style_preset, STYLE_PRESETS[DEFAULT_STYLE_PRESET])
    full_prompt = f"{prompt}\\n\\n{style['suffix']}"

    image_bytes = None
    try:
        import urllib.parse
        if OPENAI_API_KEY:
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
            image_bytes = base64.b64decode(image_b64)
        else:
            logger.info("Using free Pollinations API for illustration generation")
            encoded_prompt = urllib.parse.quote(full_prompt[:1000])
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                response = await http_client.get(url)
            response.raise_for_status()
            image_bytes = response.content

    except Exception as exc:
        logger.error("Image generation failed: %s", exc)
        return ""

    # Save image to local static directory
    proj_dir = ILLUSTRATIONS_DIR / project_id
    proj_dir.mkdir(parents=True, exist_ok=True)
    image_path = proj_dir / f"{page_id}.png"
    image_path.write_bytes(image_bytes)"""
    
    content = content.replace(old_ill, new_ill)

    # 5. Patch _generate_cover_image
    old_cov = """    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — skipping cover image generation")
        return ""

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
    image_path.write_bytes(image_bytes)"""

    new_cov = """    image_bytes = None
    try:
        import urllib.parse
        if OPENAI_API_KEY:
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
            response.raise_for_status()
            data = response.json()
            image_b64 = data["data"][0]["b64_json"]
            image_bytes = base64.b64decode(image_b64)
        else:
            logger.info("Using free Pollinations API for cover generation")
            encoded_prompt = urllib.parse.quote(prompt[:1000])
            url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true"
            async with httpx.AsyncClient(timeout=60.0) as http_client:
                response = await http_client.get(url)
            response.raise_for_status()
            image_bytes = response.content

    except Exception as exc:
        logger.error("Cover image generation failed: %s", exc)
        return ""

    cover_dir = COVERS_DIR / project_id
    cover_dir.mkdir(parents=True, exist_ok=True)
    image_path = cover_dir / filename
    image_path.write_bytes(image_bytes)"""
    
    content = content.replace(old_cov, new_cov)

    with open('server.py', 'w', encoding='utf-8') as f:
        f.write(content)

patch_server()
