# 1. Problem Statement & Stakeholders

## Problem statement

Today, wildlife field rangers create incident reports using inconsistent Word templates and email them to supervisors for review and distribution to partner agencies. This process leads to slow approvals, missing information, limited visibility, and the risk of exposing sensitive species locations or witness identities. WildTrack RAD will let rangers create standardized reports offline, route them through appropriate approval workflows, and securely share recipient-specific report versions with partner agencies. It will also track report revisions and allow urgent notifications to rehabilitation veterinarians before the full approval process is complete. The three-month Northern Region pilot aims to reduce standard report approval time from roughly four days to under one business day, reduce the percentage of reports returned for corrections from 20% to 10% or less, achieve at least 80% adoption, and have zero sensitive-data exposures.

## Success metrics

- **Standard report approval time: under 1 business day.** Faster review reduces delays in getting incident information to appropriate partners. **Measurement:** use system submission and final-approval timestamps to calculate the median business-time duration for standard reports; compare with a baseline estimated from historical email timestamps. Confirm with Dana whether the target applies to the median or to every standard report.
- **Reports returned for corrections: 10% or less (baseline: approximately 20%).** Standardized templates and required-field checks should reduce incomplete submissions and repeat work. **Measurement:** divide the number of submitted reports returned at least once by all submitted reports during the pilot, counting each report only once.
- **Sensitive-data exposures: 0.** Unauthorized release of protected-species coordinates or informant identities poses serious safety and legal risks. **Measurement:** count confirmed unauthorized disclosures identified through audit logs, access records, and security incident reports during the pilot.
- **Northern Region adoption: at least 80%.** Rangers must actually choose WildTrack rather than continuing to use Word. **Measurement:** divide Northern Region incident reports filed in WildTrack by the total distinct Northern Region incidents logged across WildTrack and legacy processes during the pilot; reconcile duplicate entries.

**Pilot evaluation:** Evaluate the metrics at the end of the three-month Northern Region pilot. Director Linda Okafor decides whether to expand to other regions.

## Stakeholders / personas

### Persona 1: Field Ranger (primary user)
- **Goals:** file accurate incident reports quickly in the field, including offline, and arrange immediate care for injured animals
- **Pain points:** Word templates are inconsistent and time-consuming; photos are emailed separately; approval status is hard to track; connectivity is unreliable
- **Needs from system:** a process **faster than Word**, offline iPad drafts with autosave and synchronization, flexible templates, photo attachments, status visibility, and immediate minimal notices to rehab vets before approval
- **Quote (invented):** "I need to report what happened without slowing down animal care or waiting for a signal."

### Persona 2: Supervisor / Approver
- **Goals:** review reports efficiently, confirm accuracy, track workload, and control appropriate information sharing
- **Pain points:** approvals and rejections get buried in email; changes and rejection reasons are not reliably recorded; pending and overdue reports are hard to see
- **Needs from system:** a basic pending/overdue dashboard, clear approval and rejection queues, recorded reasons, revision history, and logged approvals for sensitive-data exceptions
- **Quote (invented):** "I need one place to see what's waiting on me and what was sent out."

### Persona 3: Law Enforcement Agency Recipient (state police / county sheriff)
- **Goals:** receive complete poaching case information for investigations and case files
- **Pain points:** delayed reports, missing evidence details or photos, and uncertain receipt
- **Needs from system:** secure email link with email-code verification, full **authorized** case details including evidence and witness data, attached photos, downloadable PDF, and a way to acknowledge receipt with a timestamp
- **Quote (invented):** "I need the case details together, with proof of when we received them."

### Persona 4: Wildlife Rehabilitation Veterinarian
- **Goals:** get injured wildlife into care as quickly as possible
- **Pain points:** standard report approval delays care; full case reports may contain unnecessary sensitive information
- **Needs from system:** immediate minimal urgent notice (species, condition, appropriate pickup location) **before approval**, and secure access to any subsequent relevant report without unrelated witness or criminal-case data
- **Quote (invented):** "Tell me what animal needs help and where to pick it up—right away."

### Persona 5: Law Enforcement Liaison
- **Goals:** verify poaching reports are complete and suitable for referral to police or sheriffs
- **Pain points:** incomplete evidence documentation and additional correction cycles delay criminal-case referrals
- **Needs from system:** a required secondary review for poaching incidents (including multi-category cases), structured evidence fields recording what was collected, by whom, when, and where it is stored, photos, documented decisions, and revision history
- **Quote (invented):** "A poaching report needs usable evidence details before it goes to law enforcement."

### Persona 6: System Administrator
- **Goals:** operate a reliable, secure system aligned with agency rules and changing reporting needs
- **Pain points:** complex permissions, inconsistent templates, seasonal load, and changes to sensitive-species restrictions
- **Needs from system:** template maintenance, user/role management, state-account authentication, audit logs, monitoring, and a process for keeping the sensitive species list current with Dr. Priya Anand
- **Quote (invented):** "I need to keep the templates and access rules accurate without disrupting rangers."

### Additional stakeholders (not daily users)
- **Dana Reyes — Customer / Program Manager:** confirms operational needs, pilot priorities, and acceptance criteria.
- **Linda Okafor — Director:** reviews the three-month pilot results and signs off on expansion.
- **Marcus Webb — Records Officer:** confirms retention, public records obligations, evidence documentation, and notification deadlines.
- **Dr. Priya Anand — Lead Biologist:** maintains the sensitive species list and advises on restrictions for sharing locations.
- **State IT Office:** approves hosting, authentication, device security, and offline synchronization design.
- **Agency Legal Counsel:** validates disclosure rules, evidence handling, and legal compliance.
- **Other report recipients:** U.S. Fish & Wildlife (exact protected-species locations; confirms receipt), land managers (general location within about 1 mile), agency leadership (monthly counts only, later phase), and the public (through records requests, with sensitive fields removed).

## Elicitation questions

**Questions from the Dana discovery meeting and follow-up email:**

1. Can you tell me more about your role and the current incident reporting process?
2. What information and fields appear on the current report template?
3. Which report fields are required by policy or law, and which are nice to have?
4. Who may see exact GPS coordinates, and are restrictions set by policy or case-by-case decisions?
5. What happens when a report is rejected, and who makes the corrections?
6. Which partner agencies receive reports, and what does each need to see?
7. Are there additional operational constraints or concerns, such as offline use, busy seasons, or IT requirements?
8. Should partners receive reports by email, a secure portal, or another method?
9. What would make the pilot successful, and who signs off on expansion?
10. When a report has multiple incident types, which review path takes priority?
11. Which capabilities are must-haves for spring, and which can wait until later?

**Follow-up questions for subject-matter experts:**

12. **Marcus Webb:** What is the verified U.S. Fish & Wildlife notification deadline for federally protected species (possibly 48 hours), and what record-signature and audit requirements apply?
13. **Dr. Priya Anand:** Can a sensitive species be added mid-season, and should that change who can access already-submitted reports?
14. **State IT:** Which cloud and state-account authentication methods are approved, and what controls are required for storing and syncing reports offline on state-issued iPads?
