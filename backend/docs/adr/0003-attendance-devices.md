# ADR-0003: Attendance machines, and phone clock-in until they arrive

**Status:** Accepted (phone clock-in, temporary); Accepted (test machine: ZKTeco MB160 Plus ID/ADMS, 28 Sep 2026)
**Date:** 28 Sep 2026
**Deciders:** HR lead, Accounting (payroll), Operations (sites), the Firm (Data Privacy Act review)

## Context

MSMA needs face and fingerprint attendance at 3 sites (about 180 employees). No machine has been bought yet. A candidate
from Shopee is the **Deli E3765** (the same listing also shows a **Deli ES161**, so check which model ships):

|                             | Deli E3765 (listing)                                  | Deli ES161 (listing)         |
| --------------------------- | ----------------------------------------------------- | ---------------------------- |
| Face / fingerprint capacity | 200 faces / 1,000 fingerprints                        | 200 faces / 500 fingerprints |
| Records                     | 100,000 (maker's site says 120,000)                   | 80,000                       |
| Connection                  | **USB flash drive only** ("use offline, no internet") | USB only                     |
| Price                       | about ₱3,219                                          | same listing                 |

The HRIS already receives punches **automatically** from machines that speak the **ZKTeco ADMS (push)** protocol
(`/iclock`, see `apps/api/src/devices/zk-adms.adapter.ts`, tested with `pnpm simulate:punch`). The machine pushes each
punch to the server within seconds, and the dashboard shows who is in, late or absent live.

In the meantime HR wants to test clock-in with biometrics now.

## Decision

1. **Now (temporary):** employees clock in and out from the **phone app**, confirmed with the **phone's own lock**:
   fingerprint, face unlock / Face ID, or the phone's PIN, pattern or password.
   - The check runs on the phone (`expo-local-authentication`). The app only learns "confirmed", so **no fingerprint or
     face data reaches MSMA**. Biometric consent (for the office machines) is therefore not needed for this step.
   - The punch records how the phone was unlocked: `PHONE_BIOMETRIC` ("Phone (fingerprint / face)") or `PHONE_PASSCODE`
     ("Phone (PIN / password)"), shown in Live punches on the dashboard.
   - A phone without any screen lock cannot clock in. The app tells the employee how to set one.
   - Switch it off with `PHONE_CLOCK_ENABLED=false` once the machines are in use (the API then answers "Please use the
     attendance machine at your site").
2. **Test machine (decided):** buy **one ZKTeco MB160 Plus ID/ADMS** for the main site, for testing only.
   - Face, fingerprint, ID card and PIN; 3,000 faces / 3,000 fingerprints (Plus version); TCP/IP (LAN cable) and ADMS
     push, so it works with the HRIS today with no new code.
   - Price seen 28 Sep 2026: **₱10,763** (Murakami, on sale from ₱18,480); other PH resellers list the MB160 up to
     ₱21,000. Confirm the price, a 1-year warranty and the official receipt before paying.
   - Before paying, the seller must confirm the unit is the **ADMS** version (menu: Comm. → Cloud Server Setting). Some
     MB160 listings sell ADMS as an option.
   - If testing goes well, buy one per site (3 in total), or move up to the MB460 (1,500 faces, visible-light face) if the
     MB160's face reading is not good enough under the sites' lighting.
3. **The Deli E3765 / ES161 is fine as a stand-alone time clock, not as the HRIS machine.** If it is bought anyway, HR
   exports the report to a USB flash drive and uploads the file; we would add an "Import attendance file" screen, built
   from a real sample export.

## Options considered

### A. Networked machine with ADMS push (chosen for testing: ZKTeco MB160 Plus ID/ADMS)

| Model (PH listings, 28 Sep 2026) | Face / fingerprint | Network, ADMS              | Price seen     | Verdict                                   |
| -------------------------------- | ------------------ | -------------------------- | -------------- | ----------------------------------------- |
| **ZKTeco MB160 Plus ID/ADMS**    | 3,000 / 3,000      | TCP/IP, ADMS               | ₱10,763 (sale) | **Chosen for testing**                    |
| ZKTeco MB10-VL                   | 100 / 500          | TCP/IP, ADMS               | ₱12,500        | Too few faces for a site                  |
| ZKTeco MB20-VL                   | visible-light face | TCP/IP, Wi-Fi option, ADMS | not found      | Good alternative if priced near the MB160 |
| ZKTeco MB460 ADMS                | 1,500 / 2,000      | TCP/IP, ADMS               | ask resellers  | Upgrade path                              |
| Deli E3765 / ES161               | 200 / 1,000        | USB only                   | ₱3,219         | Not for the HRIS (option B)               |

| Dimension         | Assessment                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Fit with the HRIS | Works now: automatic, live, no USB trips                                                                   |
| Cost              | Higher than the Deli (ask local resellers)                                                                 |
| Capacity          | MB460: 1,500 faces, 2,000 fingerprints, 100,000 records                                                    |
| Risk              | Needs the site network to reach the server (the machine stores punches while offline and sends them later) |

### B. Deli E3765 / ES161 (USB only)

| Dimension         | Assessment                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fit with the HRIS | Manual: someone exports a file per site, per cutoff; the dashboard is not live                                                                              |
| Cost              | About ₱3,219 each                                                                                                                                           |
| Capacity          | 200 faces per machine: enough per site, tight if one machine serves many people                                                                             |
| Risk              | The export format is unknown until we see a sample; late or forgotten exports delay payroll; biometric data sits on a machine with no admin lock we know of |

### C. Phone only (no machines)

| Dimension | Assessment                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fit       | Already built (this ADR), good for testing                                                                                                                                                       |
| Cost      | ₱0                                                                                                                                                                                               |
| Risk      | Proves "someone who can unlock this phone", not "this employee at this site": a relative's fingerprint, or a shared PIN, would pass. A modified app could skip the check. No location check yet. |

## Consequences

- Testing can start today on any phone (Expo Go, the dev build, Android and iPhone). In **Expo Go on iPhone, Face ID may
  not be offered**; the app then uses the phone's passcode. The dev build shows Face ID.
- Phone punches are not proof of presence. For payroll disputes, rely on machine punches once they exist.
- Before phones are used for real (if at all): add the site location check (geofence), register each employee's phone
  (one phone per employee), and consider a server-verified check (passkeys / App Attest / Play Integrity).

## Action items

1. [x] Phone clock-in with fingerprint / face / PIN, recorded per punch, with a switch to turn it off.
2. [x] Decide on the test machine: ZKTeco MB160 Plus ID/ADMS (one unit). [ ] Seller confirms ADMS, warranty, OR.
3. [ ] When the machine arrives: send the serial number (on the back label, or Menu → System Info). We register it in
       the HRIS, then set on the machine: Comm. → Ethernet (same network as the server) and Comm. → Cloud Server Setting →
       server address = the HRIS server, port 4000 (for testing on the laptop: the laptop's Wi-Fi/LAN address). Test one
       punch, then enroll test users.
4. [ ] Before enrolling anyone's face or fingerprint on the machine: their signed biometric consent is in the 201 file
       (the HRIS shows who has it), and a non-biometric option (ID card or PIN) is available for anyone who says no.
5. [ ] If a USB-only machine is chosen: send a sample export file, then build "Import attendance file".
6. [ ] Firm: privacy notice and biometric consent wording for the office machines (Data Privacy Act, RA 10173).
