# WildTrack RAD: Prototype

A small working prototype of two user stories from the WildTrack RAD requirements spec. It's a fictional portfolio project: the agency, people, and data are made up.

| Story | Requirements | What it shows |
|---|---|---|
| **Ranger saves a draft** | FR-02, FR-03, FR-10; TR-02.1–02.6, TR-03.2, TR-03.4, TR-10.2/10.4 | Save a partial report, reopen it with every field restored, and see Submit blocked by the **server** with a list of missing fields (including poaching evidence on a combined report) |
| **Partner sees a redacted report** | FR-05, FR-28; TR-05.1–05.7 | Switch "View as" between recipients; the **server** applies the disclosure policy table and returns `[REDACTED]` or a generalized location, so restricted values never reach the browser |

## Run it

Requires **Node.js 18 or newer** (check with `node -v`; install from nodejs.org if needed). There are no packages to install.

```bash
cd prototype
node server.js
# open http://localhost:3000
```

Run the automated tests:

```bash
node --test
```

## Demo walkthrough (matches 05_demo_script.md)

1. **Ranger: Author report** tab. Check *Injured / dead wildlife* and *Suspected poaching*, type **Bald eagle** (the sensitive-species banner appears), fill a field or two, and click **Save draft**. The draft appears in *My drafts*.
2. Click **New report**, then reopen the draft from *My drafts*. Every field is restored.
3. Click **Submit for approval**. The server refuses and lists the missing fields, including poaching evidence.
4. **View as recipient** tab. Choose report **NR-2026-00041** (bald eagle, poaching).
   - *State police / county sheriff*: full coordinates, witness, and evidence (poaching case)
   - *Land manager*: location generalized to about 1 mile; witness and evidence withheld
   - *Rehabilitation veterinarian*: approximate location; witness and evidence withheld
   - *Public*: county only
5. Open browser dev tools → **Network**, click the `reports/…` request, and show that the JSON itself has no exact coordinates. That proves server-side enforcement (TR-05.5).
6. Switch to **NR-2026-00040** (mule deer, not sensitive): the land manager now sees the full location (TR-05.6).

## How the code traces to the spec

| Code (server.js) | Traces to |
|---|---|
| `FIELD_DATA_CLASS` | TR-05.1: every field carries a data class |
| `POLICY` table | TR-05.2: recipient × data class × context (sensitive species, poaching) → outcome. Values come from the spec's starting policy table |
| `generalizeLocation()` / `GRID_DEGREES` | TR-05.3: approximate (~0.25 mi) and ~1 mile generalization; county for the public |
| `recipientView()` | TR-05.4, TR-05.5, TR-05.6: the recipient view is built on the server |
| `auditLog` | TR-05.7: each disclosure logged with role and outcomes (`GET /api/audit`) |
| `missingRequiredFields()` | TR-03.2: core fields **plus** every selected incident type's required fields (the shot-eagle case) |
| `POST /api/reports/:id/submit` → 422 | TR-03.4: the server doesn't trust the client's check |
| `hasAnyContent()` | TR-02.6: empty drafts are rejected |
| Draft author checks | TR-02.4: drafts are visible only to their author |

## Test results

`test/api.test.js` contains 13 automated tests. Each test is named with its test case ID (TC-01 to TC-13) and the requirements it verifies, so results map directly to `04_test_cases.csv` and the traceability matrix. All 13 pass.

## Deliberately out of scope

| Not built | Spec reference | Why |
|---|---|---|
| Real sign-in | NFR-09, IF-01 | Identity is simulated with `X-User` / `X-Role` headers; production uses State SSO and partner one-time codes |
| Offline storage, encryption, sync | FR-07, FR-08, TR-02.2, NFR-10, IF-02 | Needs the native iPad app; the prototype runs in a browser with an in-memory server |
| Approval workflow, liaison review, notifications | FR-04, FR-13, FR-14, FR-30 | Outside these two stories |
| PDF, receipts, secure links | FR-19, FR-21, FR-22, FR-32, NFR-11 | Outside these two stories |
| Persistent database | NFR-13 | Data resets when the server restarts |

## Finding from testing

**Free-text fields can leak restricted information.** The narrative field is classed as `general`, so every recipient sees it. In the seeded eagle report, the narrative mentions the spent casing, which is evidence the land manager's view otherwise withholds. Field-level redaction can't protect details a ranger types into free text.

Options to raise with the customer:
1. Give the narrative its own data class and withhold it from some recipients.
2. Add a separate "partner summary" field written for external audiences.
3. Prompt rangers not to put evidence, witness, or exact-location details in the narrative.

This becomes a new open question for Dana and Legal Counsel.
