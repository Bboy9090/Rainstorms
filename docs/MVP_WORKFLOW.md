# MVP Workflow - Your First Book

This document walks you through creating your first book with Rainstorms, from idea to published PDF.

---

## Prerequisites

Before starting, ensure:
- ✅ Backend is running on `http://localhost:8001`
- ✅ Frontend is running on `http://localhost:8081`
- ✅ MongoDB is connected
- ✅ `OPENAI_API_KEY` or `GEMINI_API_KEY` is set in `backend/.env`

Run `bash verify-setup.sh` to check all prerequisites.

---

## The Complete Workflow

### Path 1: Try the Demo (No API Key Required) ⚡

**Time: ~5 minutes**

This path lets you explore the full Rainstorms interface without making any AI API calls.

1. **Open the app**
   - Navigate to http://localhost:8081

2. **Load the demo project**
   - Click **"Try Demo Project"** on the home screen
   - You'll see the pre-loaded story: *"Captain Blanket and the Midnight Brother"*

3. **Explore the Story Blueprint**
   - Title: "Captain Blanket and the Midnight Brother"
   - Hook: One-line story summary
   - Summary: Full story description
   - Theme: Core message of the story
   - Page-by-page outline: 10 pages with scene descriptions

4. **View the Characters**
   - Navigate to the **Characters** tab
   - See Oliver (the protective big brother)
   - See Baby Max (the infant being protected)
   - Each character has:
     - Name
     - Role in story
     - Personality traits
     - Appearance description
     - Age

5. **Explore the Page Builder**
   - Navigate to **Page Builder**
   - Browse all 10 pages
   - Each page shows:
     - Page number
     - Story text
     - Illustration prompt (for artists/AI)

6. **Export the book**
   - Click **"Export"** in the bottom navigation
   - Choose format:
     - **Story PDF** — formatted story text
     - **Prompts PDF** — illustration prompts for artists
     - **Text** — plain text export
     - **JSON** — structured data export
   - Click **"Download"**

**Result**: You've seen the complete end-to-end flow without spending any API credits.

---

### Path 2: Create Your First Book (Requires API Key) 🎨

**Time: ~15-30 minutes (depending on page count)**

This is the real MVP workflow — turning an idea into a complete book.

#### Step 1: Create a New Project

1. Open http://localhost:8081
2. Click **"Create New Project"**
3. You'll be taken to the **Idea Lab**

#### Step 2: Generate Story Blueprint

1. In the **Idea Lab**, enter your story idea:
   ```
   Captain Blanket protects his baby brother from night monsters
   ```

2. Configure story settings:
   - **Tone**: Cozy, Adventurous, Funny, etc.
   - **Age Range**: 3-5, 6-8, etc.
   - **Page Count**: 10-30 pages

3. Click **"Generate Story Blueprint"**

4. Wait 10-30 seconds for AI generation

5. Review the generated blueprint:
   - ✅ Title
   - ✅ Hook (one-line summary)
   - ✅ Full summary
   - ✅ Theme
   - ✅ Page-by-page outline

6. If you like it, click **"Accept Blueprint"**
   - If not, click **"Regenerate"** or edit the fields manually

#### Step 3: Review Characters

1. After accepting the blueprint, you're taken to **Characters**

2. The AI has auto-generated characters from your story:
   - Names
   - Roles
   - Personalities
   - Appearance descriptions

3. You can:
   - Edit character details
   - Add new characters
   - Delete unwanted characters

4. When satisfied, navigate to **Page Builder**

#### Step 4: Generate Page Text

1. In **Page Builder**, you'll see your page outline

2. Generate pages:
   - **Option A**: Click **"Generate All Pages"** (generates all at once)
   - **Option B**: Click **"Generate"** on individual pages

3. Each page will show:
   - Story text (200-300 words per page)
   - Illustration prompt

4. Improve individual pages:
   - Click **"Improve This Page"**
   - Choose modifier:
     - Make it funnier
     - Make it cozier
     - Simplify language
     - Add more detail
     - Make it more exciting

#### Step 5: Generate Illustrations (Optional)

> **Note**: This requires `OPENAI_API_KEY` and uses DALL-E 3 credits (~$0.04-0.08 per image)

1. On any page, click **"Generate Illustration"**

2. Wait 10-20 seconds

3. The AI-generated image appears on the page

4. Repeat for all pages or just selected pages

#### Step 6: Layout Pages (Optional)

1. Navigate to **Storybook Preview**

2. View your pages in a book layout:
   - Single page view
   - Two-page spread view

3. Adjust layout settings:
   - Text position (top, bottom, left, right)
   - Image size
   - Margins

#### Step 7: Generate Cover (Optional)

1. Navigate to **Cover Generator**

2. Enter cover details:
   - Title
   - Author name
   - Tagline
   - Back blurb

3. Choose a cover style:
   - Illustrated
   - Minimalist
   - Bold
   - Vintage

4. Click **"Generate Cover"**

#### Step 8: Export Your Book

1. Navigate to **Export** (bottom tab)

2. Choose export format:
   - **Story PDF** — book text with optional images
   - **Prompts PDF** — all illustration prompts for artists
   - **Full JSON** — complete project data
   - **Plain Text** — story text only

3. Click **"Download"**

4. Open the PDF and **review your book**!

---

## The Moment It Works 🎉

You know Rainstorms is working when you:

1. Type a one-sentence idea:
   ```
   Captain Blanket protects his baby brother from night monsters
   ```

2. And 15-30 minutes later, you have:
   - ✅ A complete story (10-30 pages)
   - ✅ Named characters with personalities
   - ✅ Illustration prompts for each page
   - ✅ Optional AI-generated images
   - ✅ A downloadable PDF

**That's the MVP.** 🌧️

You've gone from:
```
Idea → Blueprint → Characters → Pages → Illustrations → PDF
```

Everything else is iteration.

---

## What's Next?

Once you've completed your first book, you can:

### 1. Refine Your Story
- Edit page text directly in the UI
- Regenerate specific pages
- Adjust character descriptions
- Modify the tone or complexity

### 2. Add More Visual Details
- Lock illustration styles to maintain consistency
- Generate character reference sheets
- Create multiple cover variations

### 3. Export for Publishing
- Use the **Publishing Center** to export in different formats
- Add ISBN metadata
- Configure page dimensions for print

### 4. Share Your Work
- Export as PDF and share with friends/family
- Print physical copies via services like Lulu or Blurb
- Create a portfolio of books

---

## Troubleshooting

### "Generate Blueprint" does nothing
- Check that `OPENAI_API_KEY` or `GEMINI_API_KEY` is set in `backend/.env`
- Check backend logs for errors: look at the terminal running `uvicorn`
- Verify the backend is reachable: http://localhost:8001/api/health

### "Generate All Pages" is slow
- This is normal! Generating 10-30 pages takes 2-5 minutes
- Each page requires an AI API call
- Progress is saved incrementally

### Illustrations won't generate
- Check that `OPENAI_API_KEY` is set (required for DALL-E 3)
- Verify you have OpenAI credits
- Each illustration costs ~$0.04-0.08

### Export fails
- Check backend logs for errors
- Ensure all pages have been generated
- Try a different export format

---

## API Usage and Costs

### OpenAI (GPT-4 + DALL-E 3)

**Text generation** (story, pages, characters):
- Model: GPT-4-turbo
- Cost: ~$0.01 per 1000 tokens
- Typical book (20 pages): ~$0.20-0.50

**Image generation** (illustrations):
- Model: DALL-E 3
- Cost: ~$0.04-0.08 per image
- Typical book (20 images): ~$0.80-1.60

**Total cost per book**: ~$1.00-2.10

### Google Gemini (text only)

**Text generation**:
- Model: Gemini 2.0 Flash
- Cost: Free tier available
- ~$0.02 per 1000 tokens after free tier

You can mix providers:
- Use Gemini for text (`LLM_PROVIDER=gemini`)
- Use OpenAI for images (requires `OPENAI_API_KEY`)

---

## Tips for Better Books

### 1. Be Specific in Your Idea
❌ "A story about a dog"
✅ "A golden retriever puppy learns to be brave during his first thunderstorm"

### 2. Use the Modifiers
After generating a page, use **"Improve This Page"** to:
- Adjust tone (funnier, cozier, more exciting)
- Simplify or add complexity
- Fix pacing issues

### 3. Edit Characters Before Generating Pages
Characters are used as context when generating page text. Make sure:
- Names are correct
- Personalities are accurate
- Appearances are detailed

### 4. Lock Your Style
If you like the style of a particular page:
- Use the **Illustration Style Lock** feature
- All future illustrations will match that style

### 5. Use Story Memory
The **Story Memory** feature tracks:
- Character names and traits
- Key plot points
- Tone and style

This ensures consistency across all pages.

---

## Ready to Build More?

Once you've completed one book, the possibilities are endless:

- **Series**: Create sequels with the same characters
- **Different genres**: Try different tones and age ranges
- **Collaborations**: Share projects with co-authors
- **Print**: Export print-ready PDFs

**The hard part is done. You have a running app. Now iterate and make it better.** 🚀

---

## Support

- **Detailed setup**: [GETTING_STARTED.md](GETTING_STARTED.md)
- **API reference**: http://localhost:8001/docs (when running locally)
- **Issues**: [github.com/Bboy9090/Rainstorms/issues](https://github.com/Bboy9090/Rainstorms/issues)
