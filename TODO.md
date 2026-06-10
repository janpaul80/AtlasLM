# AtlasLM Auth/Core Workflow Stabilization TODO

## Approved Targeted Patch (Current)
- [x] Update `frontend/app/dashboard/page.tsx`
  - [x] Remove all public provider names from user-facing UI text/labels/badges
  - [x] Replace with AtlasLM-only branding (AtlasLM AI / AtlasLM Engine / AtlasLM Research wording)
  - [x] Fix Website URL input + Add button layout so button is fully visible and responsive
  - [x] Keep YouTube/Audio/Image in roadmap preview with planned-support wording
- [x] Update `backend/app/services/rag.py`
  - [x] Add lightweight conversational mode for greetings/thanks
  - [x] Keep strict grounded mode for research questions with source-based responses/citations
- [ ] Restart backend runtime so latest code is loaded
- [ ] Retest and report strict PASS/FAIL
  - [ ] Public provider branding removed
  - [ ] Website URL ingestion works
  - [ ] URL Add button fully visible/responsive
  - [ ] “hi” greeting returns conversational response
  - [ ] Grounded/source question behavior preserved with citations
