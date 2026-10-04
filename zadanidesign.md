# Technické zadání a specifikace designu: KiYoDo Web Downloader

## 1. Úvod a kontext projektu

Aplikace **KiYoDo** je moderní webový nástroj určený pro analýzu, přehrávání a stahování video a audio obsahu z platformy YouTube ve vysoké kvalitě (MP3 až 320 kbps, MP4 až 1080p/4K).

- **Pracovní adresář:** `c:\Users\janky\.gemini\antigravity\scratch\YoutubeDownloader`
- **Produkční URL:** [https://www.ekobio.org/KiYoDo/](https://www.ekobio.org/KiYoDo/)
- **Hostingové prostředí:** IIS / Kestrel na ASPONE (`windows11.aspone.cz`), nasazení do `/www/wwwroot/KiYoDo` a `/www/KiYoDo`.
- **Cíl designu:** Poskytnout uživatelům prémiový, esteticky vyladěný zážitek prostřednictvím systému volitelných vizuálních témat (Multi-Theme Engine), která propojují moderní technologie s přírodními, historickými, hermetickými a východními motivy, aniž by došlo k jakémukoliv omezení existující funkcionality.

---

## 2. Architektura Multi-Theme Engine

Systém témat je navržen s důrazem na nulový výkonnostní dopad (zero-dependency runtime), čisté oddělení prezentační logiky a absolutní prevenci probliknutí neastylovaného obsahu (Zero FOUC).

### 2.1 Princip přepínání a persistence
1. **Kořenový selektor:** Téma je definováno atributem `data-theme` na kořenovém elementu `<html>`.
2. **Persistence:** Zvolené téma se ukládá do `localStorage` pod klíčem `kiyodo_theme`.
3. **Detekce a inicializace (Prevence FOUC):**
   V `<head>` souboru `index.html` je umístěn synchronní inicializační skript, který ještě před prvním vykreslením DOMu načte hodnotu z `localStorage` a nastaví patřičný atribut `data-theme` a třídu `dark`/`light`.
   ```html
   <script>
     (function() {
       try {
         var saved = localStorage.getItem('kiyodo_theme') || 'default';
         document.documentElement.setAttribute('data-theme', saved);
         if (saved === 'hermetic') {
           document.documentElement.classList.remove('dark');
           document.documentElement.classList.add('light');
         } else {
           document.documentElement.classList.add('dark');
           document.documentElement.classList.remove('light');
         }
         var savedBg = localStorage.getItem('kiyodo_bg_style') || 'artwork';
         document.documentElement.setAttribute('data-bg', savedBg);
       } catch (e) {}
     })();
   </script>
   ```

### 2.2 Duální systém pozadí (Artwork vs Texture Mode)
Aplikace podporuje volitelný přepínač stylu pozadí:
1. **`artwork` (Plnohodnotná grafika — výchozí):**
   - Načítá velkoformátové 16:9 atmosférické ilustrace na míru každému tématu.
   - Využívá jemný `radial-gradient` maskovací filtr přecházející v barvu `--app-bg` v centrální oblasti pro zachování 100% čitelnosti textu (WCAG AA).
   - Zdroje: `bg_default.webp`, `bg_hermetic.webp`, `bg_animism.webp`, `bg_flow.webp` v `src/assets/backgrounds/` optimalizované pro web (37 až 340 kB).
2. **`texture` (Minimalistická textura):**
   - Vypíná velké ilustrace a aktivuje ultra lehkou vektorovou SVG mikro-strukturu (papírová vlákna, lišejníková turbulence, nefritové křivky nebo jemný šum) s průhledností 2–5 %.
3. **Uživatelská volba:** Nastavuje se v dialogu nastavení (`SettingsModal.tsx`) a ukládá do `localStorage` pod klíčem `kiyodo_bg_style`.

---

## 3. Schéma designových tokenů (CSS Custom Properties)

Všechny komponenty aplikace využívají sadu standardizovaných CSS proměnných deklarovaných v souboru `src/themes.css`. Žádná komponenta nesmí používat natvrdo vepsané barvy pozadí či textu tam, kde se má vzhled přizpůsobovat tématu.

| Token | Popis |
| :--- | :--- |
| `--app-bg` | Celkové pozadí aplikace |
| `--panel-bg` | Pozadí hlavních karet a dialogů |
| `--panel-surface` | Pozadí vnitřních interaktivních ploch (inputy, sekundární tlačítka, kódové bloky) |
| `--panel-border` | Ohraničení a oddělovače komponent |
| `--panel-shadow` | Stín panelů podporující hloubku rozhraní |
| `--text-primary` | Hlavní čitelný text a nadpisy |
| `--text-muted` | Doplňkový, vysvětlující a metadatový text |
| `--accent-primary` | Primární akcentní barva (tlačítka akce, aktivní záložky, ikony) |
| `--accent-hover` | Barva akcentu při najetí kurzorem |
| `--accent-contrast` | Kontrastní barva textu na akcentním pozadí (čistě bílá / tmavá) |
| `--badge-bg` | Pozadí štítků a pilulek s informacemi |
| `--badge-text` | Barva textu ve štítcích |
| `--ui-radius-sm` | Malé zaoblení (tagy, malé přepínače) |
| `--ui-radius-md` | Standardní zaoblení (tlačítka, vstupní pole) |
| `--ui-radius-lg` | Velké zaoblení (hlavní karty, panely) |
| `--font-heading` | Rodina písma pro nadpisy |
| `--font-body` | Rodina písma pro běžný text |
| `--font-mono` | Rodina písma pro technická data, formáty a skripty |

---

## 4. Specifikace jednotlivých témat

Aplikace obsahuje 4 plnohodnotná témata pokrývající různé vizuální preference:

```
               ┌────────────────────────────────────────────────────────┐
               │              KiYoDo Multi-Theme Engine                 │
               └────────────────────────────────────────────────────────┘
                                           │
         ┌──────────────────┬──────────────┴─────┬──────────────────┐
         ▼                  ▼                    ▼                  ▼
   ┌───────────┐     ┌──────────────┐     ┌─────────────┐     ┌───────────┐
   │  default  │     │   hermetic   │     │   animism   │     │   flow    │
   │  Modern   │     │ Alchymistický│     │Lesní rituál │     │ Východní  │
   │ Dark Red  │     │   Pergamen   │     │ & Animismus │     │  Organika │
   └───────────┘     └──────────────┘     └─────────────┘     └───────────┘
```

### 4.1 Téma `default` — Modern Dark (YouTube Red & Slate)
- **Koncept:** Moderní technologický styl navazující na YouTube studio s vysokým kontrastem.
- **Barevná paleta & Tokeny:**
  - `--app-bg`: `#090c10` (Hluboká vesmírná čerň)
  - `--panel-bg`: `#0d121a` (Tmavá břidlice)
  - `--panel-surface`: `#131a24`
  - `--panel-border`: `rgba(255, 255, 255, 0.1)`
  - `--text-primary`: `#f0f3f6`
  - `--text-muted`: `#8b949e`
  - `--accent-primary`: `#e61e2b` (YouTube červená)
  - `--accent-hover`: `#c41822`
  - `--accent-contrast`: `#ffffff`
  - `--badge-bg`: `#1c2738`
  - `--badge-text`: `#58a6ff`
  - `--ui-radius-sm`: `6px`, `--ui-radius-md`: `10px`, `--ui-radius-lg`: `14px`
- **Typografie:** `Plus Jakarta Sans` / `Inter`, monospace `JetBrains Mono`.
- **Pozadí:** Jemný technologický šum (noise texture, opacity 2 %).

### 4.2 Téma `hermetic` — Alchymistický atlas & Renesanční pergamen (Světlý styl)
- **Koncept:** Vzhled starého alchymistického manuskriptu, renesančního herbáře a rytiny. Zlatavý pergamen, tmavý kaligrafický inkoust a akcenty voskového karmínu.
- **Barevná paleta & Tokeny:**
  - `--app-bg`: `#f4efeb` (Přírodní pergamen)
  - `--panel-bg`: `#eae2d6` (Bělený papír kodexu)
  - `--panel-surface`: `#dfd5c4`
  - `--panel-border`: `rgba(92, 88, 80, 0.35)`
  - `--text-primary`: `#1e2229` (Starý inkoust z duběnek)
  - `--text-muted`: `#5e5a52` (Sépie)
  - `--accent-primary`: `#8b2635` (Voskový karmín / cechovní pečeť)
  - `--accent-hover`: `#701c29`
  - `--accent-contrast`: `#ffffff`
  - `--badge-bg`: `#d5c8b5`
  - `--badge-text`: `#3c3830`
  - `--ui-radius-sm`: `2px`, `--ui-radius-md`: `4px`, `--ui-radius-lg`: `6px`
- **Typografie:**
  - Nadpisy: `Cormorant Garamond`, `Cinzel`, `serif`
  - Tělo: `Source Serif 4`, `EB Garamond`, `serif`
  - Monospace: `JetBrains Mono`
- **Vizuální prvky:** Teplé stíny, jemná textura vláknitého pergamenu na pozadí, klasické hranatější nebo jemně zaoblené kontury.

### 4.3 Téma `animism` — Lesní rituál & Animismus (Hluboký mechový dark mode)
- **Koncept:** Noční hluboký hvozd, mech, kapradí a doutnající jantarové rituální světlo.
- **Barevná paleta & Tokeny:**
  - `--app-bg`: `#0b0f0c` (Černozelená půda pralesa)
  - `--panel-bg`: `#121914` (Hluboký mech)
  - `--panel-surface`: `#18221b`
  - `--panel-border`: `rgba(86, 114, 91, 0.3)`
  - `--text-primary`: `#dce3db` (Bledé měsíční světlo)
  - `--text-muted`: `#7e8d80` (Vysušená tráva a kapradí)
  - `--accent-primary`: `#d97724` (Doutnající jantar)
  - `--accent-hover`: `#b86219`
  - `--accent-contrast`: `#0b0f0c`
  - `--badge-bg`: `#1c2d20`
  - `--badge-text`: `#68c07e`
  - `--ui-radius-sm`: `4px`, `--ui-radius-md`: `8px`, `--ui-radius-lg`: `12px`
- **Typografie:**
  - Nadpisy: `Almendra`, `Cinzel`, `serif`
  - Tělo: `Inter`, system-ui, `sans-serif`
- **Vizuální prvky:** Organická textura inspirovaná buněčnou strukturou listů a noční mlhou.

### 4.4 Téma `flow` — Východní organika & Tok Ki (Plynulé linie a nefrit)
- **Koncept:** Proudění životní energie (Ki), hladina horského jezera a terakotově leštěná měď na temném nefritu.
- **Barevná paleta & Tokeny:**
  - `--app-bg`: `#091312` (Hlubina horského jezera)
  - `--panel-bg`: `#0f1d1c` (Temný nefrit)
  - `--panel-surface`: `#162826`
  - `--panel-border`: `rgba(45, 122, 105, 0.35)`
  - `--text-primary`: `#ecf3f0` (Čistý pramen)
  - `--text-muted`: `#6f8c85` (Mlha nad vodou)
  - `--accent-primary`: `#c35a38` (Terakota / leštěná měď)
  - `--accent-hover`: `#a84b2c`
  - `--accent-contrast`: `#ffffff`
  - `--badge-bg`: `#15332c`
  - `--badge-text`: `#48c9aa`
  - `--ui-radius-sm`: `10px`, `--ui-radius-md`: `16px`, `--ui-radius-lg`: `24px`
- **Typografie:**
  - Nadpisy: `Playfair Display`, `serif`
  - Tělo: `Plus Jakarta Sans`, system-ui, `sans-serif`
- **Vizuální prvky:** Měkké organické křivky s velkým rádiusem, vlnová nefritová mikrografika na pozadí.

---

## 5. Typografický systém a Google Fonts

Do hlavičky aplikace jsou zahrnuty následující typografické rodiny:
- `Cinzel` (500, 700) – monumentální antické nápisy a hermetické záhlaví
- `Almendra` (400, 700) – animistické a magické stylizované nadpisy
- `Cormorant Garamond` (400, 600, 700) – renesanční elegance
- `Playfair Display` (500, 600, 700) – fluidní moderní serif
- `Source Serif 4` (400, 600) – knižní čtivý antikvový text
- `Plus Jakarta Sans` & `Inter` – čistá geometrická čitelnost UI
- `JetBrains Mono` (400, 500, 600) – přesné zobrazení URL, časových kódů a skriptů

---

## 6. Komponentová specifikace

### 6.1 Hlavička a přepínač témat (`Header.tsx`)
- Logo **KiYoDo** s dynamickou ikonou a popisem.
- Navigační přepínač záložek (Stahovač, Vyhledávač, Hromadné stahování, PC návod, Historie).
- **Theme Selector Dropdown:**
  - Zobrazuje aktuální téma s odpovídající ikonou (`Sparkles`, `Scroll`, `TreePine`, `Waves`).
  - Rozbalovací menu s barevnými vzorky (swatches) znázorňujícími pozadí, povrch a akcent každého tématu.
  - Zvolené téma je označeno fajfkou a okamžitě aplikováno bez reloadu stránky.
- Přepínač jazyka (CZ / EN) a tlačítko globálního nastavení.

### 6.2 Vstupní panel pro URL (`UrlInputBar.tsx`)
- Velké centrální vstupní pole se zvýrazněným ohraničením.
- Tlačítko pro rychlé vložení ze schránky (Clipboard API).
- Primární akční tlačítko pro spuštění analýzy videa.
- **Sekce Rychlé vyzkoušení:**
  - Seznam přednastavených ukázkových skladeb a videí pro okamžité otestování jedním kliknutím:
    1. *DRIÁK - Tady je Krakonošovo!*
    2. *Action Price 2026 Online Video*
    3. *Vision Days - Cesta do hlubin punkáčovy duše*
    4. *Námesícná*
    5. *KAPRIOLA - Ona se dívá*

### 6.3 Karta náhledu a stahování (`VideoPreviewCard.tsx`)
- **Náhled a metadata:** Titulek videa stylizovaný fontem `--font-heading`, jméno kanálu, délka, počet zhlédnutí a datum publikace.
- **Formátový přepínač:** Segmentovaný přepínač mezi **MP3 (Pouze zvuk)** a **MP4 (Video se zvukem)**.
- **Mřížka kvality:**
  - Pro MP3: 320 kbps (Studio), 256 kbps (Vysoká), 192 kbps (Standard), 128 kbps (Základní).
  - Pro MP4: 1080p Full HD, 720p HD, 480p SD, 360p Mobile.
- **Přímé stažení přes web:** Tlačítka pro stažení z webových bran s indikací stavu a formátu.
- **Dávkový Windows skript (.bat):**
  - Generování samospustitelného skriptu, který automaticky zajistí `yt-dlp` a stáhne video v maximální kvalitě přímo do složky `Downloads`.

### 6.4 Vyhledávání přímo na YouTube (`YouTubeSearch.tsx`)
- Živý dotazovací systém na oficiální YouTube API / scraper.
- Real-time našeptávač návrhů vyhledávání.
- Populární rychlé štítky (chips).
- Mřížka výsledků s náhledy, stopáží a okamžitými tlačítky "Stáhnout MP3" / "Stáhnout MP4".

### 6.5 Hromadný stahovač (`BatchDownloader.tsx`)
- Víceřádkový editor pro vložení desítek YouTube odkazů najednou.
- Automatická detekce platných ID a vyřazení neplatných řádků.
- Vygenerování jediného `.bat` skriptu, který stáhne celý seznam bez další interakce.

### 6.6 PC Průvodce a Desktop sekce (`DesktopHelperSection.tsx`)
- Přehledný tříkrokový vizuální průvodce stažením.
- Generátor univerzálního stahovače na plochu PC.
- Návod na YouTube trik `youtubepp.com` a instalaci `yt-dlp` přes winget.

### 6.7 Historie stahování (`DownloadHistory.tsx`)
- Lokální úložiště posledních stažených položek s možností opětovného stažení a kopírování odkazu.

---

## 7. Standardy responzivity a přístupnosti (WCAG)

1. **Kontrastní poměry:** Všechna témata, zejména světlé pergamenové téma `hermetic`, musí splňovat normu WCAG AA pro minimální kontrast textu vůči pozadí (minimálně 4.5:1 pro běžný text, 3:1 pro velké nadpisy).
2. **Responzivita:** Layout je plně přizpůsoben displejům od 320 px (mobilní telefony) přes tablety až po širokoúhlé monitory (4K).
3. **Dotykové prvky:** Všechna interaktivní tlačítka mají minimální dotykovou plochu 44x44 px na mobilních zařízeních.

---

## 8. Build a nasazení na server (Deployment Pipeline)

- **Build nástroj:** Vite 8 s optimalizovaným bundle splittingem.
- **Relativní cesty:** `base: './'` v `vite.config.ts` pro bezproblémový běh v podadresáři `/KiYoDo/`.
- **Automatizovaný deploy skript (`deploy_ftp.ps1`):**
  - Nahrává soubory z lokální složky `dist` na FTP server `windows11.aspone.cz`.
  - Zajišťuje nahrání do obou virtuálních cest `/www/wwwroot/KiYoDo` i `/www/KiYoDo`.
  - Spuštění:
    ```powershell
    npm run build
    powershell -ExecutionPolicy Bypass -File .\deploy_ftp.ps1
    ```
- **Ověření:** HTTP GET dotaz s kódem 200 OK na adrese `https://www.ekobio.org/KiYoDo/`.
