# Rainstorms Demo GIF — Capture Script

This document describes how to capture the `rainstorms-demo.gif` animation showing the complete story creation flow.

## Goal

Create a smooth, professional animated GIF that demonstrates Rainstorms' core value proposition:

**Idea → Blueprint → Characters → Pages → Export**

## Specs

- **Resolution:** 1280×720 (720p, scales well for README embeds)
- **Aspect ratio:** 16:9 (standard web video)
- **Frame rate:** 15 fps (smooth motion, reasonable file size)
- **Duration:** 25–30 seconds total
- **File size target:** < 5 MB (GitHub README-friendly)
- **Format:** GIF with optimized palette

## Capture Sequence

### Scene 1: Idea Lab (4 seconds)

**Show:**
- User enters story idea: *"a brave little robot discovers emotions"*
- Selects tone (Heartwarming), age range (6–8), page count (12)
- Clicks "Generate Blueprint"

**Camera:**
- Full screen capture of Idea Lab
- Highlight the input field and generate button

**Timing:**
- 0:00–0:04

---

### Scene 2: Story Blueprint (5 seconds)

**Show:**
- Blueprint loads with animated progress indicator
- Title appears: *"BeeBot's Heart"*
- One-line hook and theme fade in
- Scroll through the 12-page outline
- Click "Accept Blueprint"

**Camera:**
- Full screen of Blueprint screen
- Slow scroll down to show outline structure

**Timing:**
- 0:04–0:09

---

### Scene 3: Character Forge (4 seconds)

**Show:**
- Two character cards appear: BeeBot and Luna
- Each card shows name, personality, appearance
- Visual brief includes color palette and traits
- Click "Next" to proceed

**Camera:**
- Full screen of Character Forge
- Brief pause on each character card

**Timing:**
- 0:09–0:13

---

### Scene 4: Page Builder (8 seconds)

**Show:**
- Page 1 with text and illustration prompt visible
- Click "Generate Page Text" → text streams in (GPT-style)
- Navigate to Page 3 (shows different content)
- Use "Make This Funnier" modifier → text updates
- Click "Generate All Remaining Pages"
- Progress indicator shows pages 4–12 generating

**Camera:**
- Full screen of Page Builder
- Show both left panel (controls) and right panel (page content)

**Timing:**
- 0:13–0:21

---

### Scene 5: Publishing Center / Export (4 seconds)

**Show:**
- Navigate to Publishing Center
- Metadata tab shows title, author, description
- Click "Export as PDF"
- Download modal appears
- PDF filename shows in browser downloads bar

**Camera:**
- Full screen of Publishing Center
- Brief view of export modal

**Timing:**
- 0:21–0:25

---

### Scene 6: Final Frame (3 seconds)

**Show:**
- Static frame with exported PDF open in viewer
- First page visible with title and story text
- Fade to Rainstorms logo or "Try it yourself" CTA

**Camera:**
- Cropped view of PDF preview

**Timing:**
- 0:25–0:28

---

## Technical Setup

### Recording Tools

**macOS:**
```bash
# Use Kap (free, open-source)
brew install --cask kap

# Or use built-in QuickTime Player:
# File → New Screen Recording → select region
```

**Linux:**
```bash
# Use Peek
sudo apt install peek

# Or use ffmpeg directly:
ffmpeg -f x11grab -s 1280x720 -i :0.0 -r 15 demo-raw.mp4
```

**Windows:**
```powershell
# Use ScreenToGif (free)
# Download from https://www.screentogif.com/
```

### Post-Processing

Convert the screen recording to an optimized GIF:

```bash
# Using ffmpeg (recommended for quality and size)
ffmpeg -i demo-raw.mp4 \
  -vf "fps=15,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  -loop 0 \
  rainstorms-demo.gif

# Check file size
ls -lh rainstorms-demo.gif

# If > 5 MB, reduce colors or resolution:
ffmpeg -i demo-raw.mp4 \
  -vf "fps=15,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer" \
  -loop 0 \
  rainstorms-demo.gif
```

**Alternative:** Use [Gifski](https://gif.ski/) for highest quality:

```bash
# macOS
brew install gifski

# Convert video to GIF
gifski demo-raw.mp4 -o rainstorms-demo.gif --fps 15 --quality 90 --width 1280
```

## Capture Tips

1. **Use demo project:** Start with "Captain Blanket" demo to avoid API costs
2. **Clear browser state:** Use incognito mode or clear cache for clean UI
3. **Hide distractions:** Close browser extensions, hide bookmarks bar
4. **Smooth cursor movement:** Move slowly and deliberately between clicks
5. **Pause on key moments:** Let important UI elements remain visible for 1–2 seconds
6. **No audio needed:** GIF is silent; focus on visual clarity
7. **Test at 2× speed:** Verify the demo still makes sense when sped up

## Fallback: Static Screenshots with Arrows

If a GIF proves difficult to create or too large, use a static image grid instead:

```
[Idea Lab]  →  [Blueprint]  →  [Characters]  →  [Pages]  →  [Export]
```

Combine 5 screenshots into a horizontal flow diagram using ImageMagick:

```bash
convert idea-lab.png blueprint.png characters.png pages.png export.png \
  +append -resize 1280x rainstorms-flow.png
```

Then embed in README with arrows overlaid or as captions.

---

## Final Output Location

Once created, place the GIF at:

```
/examples/rainstorms-demo.gif
```

And embed in the root README.md:

```markdown
## Demo Flow

![Rainstorms Demo](examples/rainstorms-demo.gif)

*From idea to published book in under 30 minutes.*
```

---

*See [README.md](README.md) for the complete examples overview.*
