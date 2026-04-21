# TYPO3-API-Referenz

> Technische Dokumentation der TYPO3-Schnittstelle. Beispiel-Payloads liegen in `features/runnerget.json` und `features/userset.json`.

**Stand:** 2026-04-21

---

## Authentifizierung

Formular-basierter Login (kein OAuth/JWT). Session-Cookie `fe_typo_user` wird bei jedem Request mitgeschickt.

Siehe `src/lib/typo3-client.ts` für die Implementierung.

---

## Endpunkte

### 1. `runnerget.json` — Läufer*innen und Läufe lesen

**Method:** POST  
**Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`

**Request-Parameter:**

| Parameter | Wert |
|-----------|------|
| `type` | `195` |
| `request[extensionName]` | `SwitRunners` |
| `request[pluginName]` | `User` |
| `request[controller]` | `User` |
| `request[action]` | `getdata` |
| `request[arguments][eventtype]` | `24d` |

**Response-Struktur:**

```json
{
  "runners": [
    {
      "uid": 5971,
      "nr": 1441,
      "name": "Bernd",
      "age": "41",
      "tshirtsize": "keins",
      "runnergroup": 0,
      "totaldistance": "18,95",
      "crdate": "16.05.2025",
      "pdfUri": "/...",
      "startnrUri": "/...",
      "runs": [
        {
          "uid": 84016,
          "rundate": "20.04.2026",
          "rundateObj": "2026-04-20",
          "distance": "8,67"
        }
      ],
      "totaldistanceFromArray": 18.95
    }
  ]
}
```

**Wichtige Formate:**

| Feld | Format | Beispiel |
|------|--------|----------|
| `distance` | Dezimalkomma (deutsch) | `"8,67"` |
| `totaldistance` | Dezimalkomma (deutsch) | `"18,95"` |
| `rundate` | `DD.MM.YYYY` | `"20.04.2026"` |
| `rundateObj` | `YYYY-MM-DD` (ISO-Kurzformat) | `"2026-04-20"` |
| `age` | String (kann leer sein) | `"41"` oder `""` |
| `totaldistanceFromArray` | Dezimalpunkt (Zahl) | `18.95` |

---

### 2. `userset.json` — Läufe schreiben (updateruns)

**Method:** POST  
**Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`

**Request-Parameter:**

| Parameter | Wert |
|-----------|------|
| `type` | `191` |
| `request[extensionName]` | `SwitRunners` |
| `request[pluginName]` | `User` |
| `request[controller]` | `User` |
| `request[action]` | `setdata` |
| `request[arguments][perform]` | `updateruns` |
| `request[arguments][userUid]` | UID des Läufers (z.B. `5920`) |
| `request[arguments][runs]` | JSON-Array aller Läufe (URL-encoded) |

**Runs-Array-Format (wie die TYPO3-Website es sendet):**

```json
[
  {"runDate": "2026-04-20 06:00:00", "runDistance": "14,13"},
  {"runDate": "2026-04-21 06:00:00", "runDistance": "1,3"},
  {"runDate": "2026-04-22 06:00:00", "runDistance": ""},
  {"runDate": "2026-04-23 06:00:00", "runDistance": ""}
]
```

**Wichtige Konventionen:**

| Aspekt | Detail |
|--------|--------|
| **Dezimaltrennzeichen** | Die TYPO3-Website sendet **Komma** (`"14,13"`). Ob Punkt ebenfalls akzeptiert wird, ist unklar — TYPO3 liefert 200 auch bei Fehlern. |
| **Datumsformat** | `YYYY-MM-DD HH:MM:SS` — die TYPO3-Website sendet immer `06:00:00` als Uhrzeit |
| **Leere Tage** | Die TYPO3-Website sendet **alle 25 Event-Tage** inklusive leerer Einträge (`"runDistance": ""`). |
| **Vollständiger Ersatz** | Jeder Request ersetzt die **komplette** Laufliste des Läufers. Kein Per-Lauf CRUD. |
| **Response bei Fehler** | TYPO3 liefert häufig HTTP 200 auch bei logischen Fehlern. Die `success`-Property im JSON-Body ist nicht zuverlässig. |

---

## Bekannte Eigenheiten

1. **Kein echtes REST:** Es gibt keine individuellen Lauf-IDs zum Aktualisieren oder Löschen
2. **Replace-All-Semantik:** Jeder Write überschreibt alle Läufe — fehlende Tage werden gelöscht
3. **Dezimalkomma vs. Dezimalpunkt:** TYPO3 liefert und erwartet Komma-Dezimaltrennzeichen in `distance`/`runDistance`. Der numerische Wert `totaldistanceFromArray` nutzt dagegen Dezimalpunkt.
4. **HTTP 200 ≠ Erfolg:** TYPO3 kann HTTP 200 zurückgeben, auch wenn intern nichts gespeichert wurde (z.B. bei abgelaufener Session)
5. **Session-Timeout:** Die `fe_typo_user`-Session kann ablaufen, ohne dass TYPO3 einen 401 zurückgibt — der Request wird scheinbar erfolgreich beantwortet, aber Daten werden nicht gespeichert
