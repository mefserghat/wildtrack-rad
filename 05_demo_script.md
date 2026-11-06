# 5. Customer Demo Script: Sprint 2 Review (3 minutes)

**Audience:** Dana Reyes (customer / program manager), simulated
**Format:** screen recording with voice-over (Loom), one take
**Goal:** show two completed stories, prove quality with traceability, and get a customer decision on one open question

Spoken words are in quotes (about 420 words, which is roughly 3 minutes at a natural pace). Bracketed lines are what to click.

---

## 0:00–0:20 | Open

[Screen: GitHub README, top of page]

> "Hi Dana, I'm Mariam. This is the Sprint 2 review for WildTrack RAD, the report authoring and dissemination tool for the Northern Region pilot. I'll show you two completed stories, how we verified them, and then I need your decision on one issue we found in testing."

## 0:20–0:40 | The problem, in the customer's words

[Scroll to the system context diagram]

> "As a reminder, today reports go out as emailed Word documents. Approvals take about four days, and sensitive details like nest locations have reached people who shouldn't have them. So far we've defined 33 functional requirements and 27 user stories. Today's stories tackle two of the biggest risks: losing work in the field, and sharing the wrong information."

## 0:40–1:25 | Story 1: Ranger saves a draft

[Switch to the prototype, **Ranger: Author report** tab]
[Check **Injured / dead wildlife** and **Suspected poaching**. Type **Bald eagle**; the yellow banner appears]

> "Here's a ranger starting a report on a shot eagle. When they enter a sensitive species, the app flags that the location will be restricted for some recipients."

[Type a short narrative, then click **Save draft**]

> "If they get called away, they save a draft. No required fields yet, and it appears under My drafts, visible only to them."

[Click **New report**, then click the draft in **My drafts**]

> "When they come back, everything is restored."

[Click **Submit for approval**]

> "If they try to submit too early, the system lists exactly what's missing, including the poaching evidence fields. That covers your shot-eagle case: a report that's both injured wildlife and poaching can't skip the evidence. This check runs on the server, so it can't be bypassed."

## 1:25–2:15 | Story 2: Partners see only what they're cleared to see

[Switch to **View as recipient**. Report: **NR-2026-00041**, View as: **State police / county sheriff**]

> "Now the same approved eagle report, from different partners' points of view. Because it's a poaching case, state police see everything: exact location, witness, and evidence."

[Change to **Land manager**]

> "A land manager sees the location only to within about a mile. The witness and evidence are withheld."

[Change to **Public (records request)**]

> "And a public records request gets the county only."

[Point to the **Raw API response** panel, or open dev tools → Network]

> "This is the actual data the server sent. The exact coordinates aren't hidden on the screen; they were never sent. Partners only receive what they're cleared to see."

## 2:15–2:40 | Quality

[Switch to `04_traceability_matrix.csv` in GitHub, or the test output from `node --test`]

> "Every requirement in these two stories traces to a user story and a test. We have 13 automated tests, all passing, and each one is named with the requirement it verifies."

## 2:40–3:00 | Finding and decision needed

[Back to the land manager view; point to the narrative]

> "One finding from testing. The evidence field is withheld here, but the ranger's narrative mentions the spent casing. Field-level redaction can't protect details typed into free text. I see three options: restrict the narrative itself, add a separate partner summary field, or prompt rangers to keep sensitive details out of the narrative. I've logged it as open question 12. Which direction would you like us to take? Next sprint: supervisor approvals and notifications. Thanks, Dana."

---

## Before you record

**Set up**
- [ ] Restart the server (`Ctrl+C`, then `node server.js`) so the data is fresh and there are no leftover drafts
- [ ] Open **http://localhost:3000** in a clean browser window. Close other tabs and hide bookmarks.
- [ ] Zoom the browser to **110–125%** so text is readable in the video
- [ ] Have three tabs ready, in order: GitHub README → prototype → traceability matrix
- [ ] Turn on Do Not Disturb (no notification pop-ups mid-recording)
- [ ] In Loom: screen + camera bubble (a small face builds trust), mic checked

**Rehearse**
- [ ] Do the clicks once without talking, so the path is automatic
- [ ] Do one full run out loud with a timer. If it's over 3:15, cut the "Public" step first.
- [ ] Say "partners only see what they're cleared to see," not "role-based access control." Dana isn't technical.

**Recording**
- One take is fine. A small stumble sounds human; don't restart for it.
- Pause for a beat after each click so viewers can see what changed.
- If the page misbehaves, refresh and keep going. Narrating calmly through a hiccup also shows you can handle a live customer demo.

**After**
- [ ] Watch it once at 1x speed; check the audio and that the text is readable
- [ ] Set Loom sharing to "Anyone with the link"
- [ ] Paste the link into the README, replacing `LINK-TO-LOOM-VIDEO`

## If an interviewer asks follow-up questions

- **"Why does the land manager see a poaching report at all?"** Good catch. Dissemination is the supervisor's choice (FR-29); this view shows what they'd see *if* sent. Default recipients per incident type are FR-24.
- **"How do you know the redaction is complete?"** TC-03 searches the entire raw response for the real coordinates and nest description, not just the location field.
- **"What would you change before production?"** Real sign-in (State SSO), the offline iPad app, encryption, a database, and the narrative decision.
