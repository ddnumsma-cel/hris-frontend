# ZKTeco device → HRIS (office setup)

How the office ZKTeco MB10-VL sends punches to the HRIS backend on one always-on PC, without the cloud.

```
ZKTeco (DHCP, on the office router) ──https──▶ this PC :4443 (zkteco-https-helper.cjs) ──http──▶ HRIS backend :4000 (/iclock)
```

**Why the helper exists:** the MB10-VL only talks to its ADMS server over https and has no setting to turn that off.
The backend serves plain http, so the helper accepts the device's https connection and passes the request on.
It only forwards `/iclock/...` requests from the registered serial (`UDP3262600211`), only listens on the PC's office
address (192.168.1.x), and requires TLS 1.2+. Once the HRIS runs behind a real https address (cloud), the helper is
not needed: point the device at that address on port 443.

## Files

| File | What it does |
| --- | --- |
| `zkteco-https-helper.cjs` | The https helper (Node, no packages). Reads `cert.pem` and `key.pem` from its own folder. |
| `start-hris.ps1` | Run at Windows sign-in: starts the backend, waits for the office Wi-Fi, starts the helper, and keeps watching (restarts either if it stops, or the helper if the PC's address changes). Logs to `logs\`. Paths inside are for the current HRIS PC; adjust them on another PC. |

## Set up on a PC

1. Copy this folder somewhere outside the repo (e.g. `C:\Users\<you>\HRIS-autostart\`).
2. Make the certificate there (it stays on that PC; `*.pem` is git-ignored):
   `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=hris-device"`
3. Register the device serial in the HRIS `Device` table, and make each person's User ID on the device equal their
   `Employee.biometricPin`. Punches under unknown IDs are ignored.
4. Startup shortcut (Win+R → `shell:startup` → New → Shortcut):
   `powershell.exe -NoProfile -WindowStyle Hidden -File "<folder>\start-hris.ps1"`
5. On the ZKTeco: COMM → Ethernet → DHCP **On**; Cloud Server Setting → server = this PC's office IP, port **4443**,
   domain name Off, proxy Off; restart the device.

While the PC or Wi-Fi is down the device keeps its punches and sends them when it reconnects (the backend ignores
duplicates). Keep the device's clock correct: punches carry the device's time.
