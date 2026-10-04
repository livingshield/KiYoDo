# KiYoDo (YouTube & Media Downloader with Bookmarks)

Moderní webová a PWA aplikace pro stahování, přehrávání a správu video a audio obsahu (YouTube, TikTok, Facebook a další) s uživatelskými účty, záložkami a klientským zpracováním médií.

## Klíčové vlastnosti

- 🎬 **Stahování videí a audia:** Podpora pro MP4 video (až 1080p, 4K dle dostupnosti) a MP3 audio (128 kbps, 320 kbps).
- ⚙️ **Klientské slučování přes WebAssembly (FFmpeg):** Rychlé spojování oddělených video + audio streamů přímo v prohlížeči uživatele bez nutnosti externích .exe binárek na serveru.
- 📁 **Uživatelské účty a záložky:**
  - Registrace / přihlášení heslem nebo jedním kliknutím přes **Google Sign-In**.
  - Tvorba vlastních složek/záložek s komentáři.
  - Plynulý přesun videí mezi záložkami (tlačítkem i pomocí **Drag & Drop**).
  - Hromadný výběr a hromadný přesun / smazání.
- 🎨 **Témata a PWA:**
  - Vzhledy: Hermetic, Animism, Default a další.
  - Progresivní webová aplikace (PWA) s offline kešováním a možností instalace na plochu mobilu či PC.
- 🚀 **Bezpečný hosting:** Plně kompatibilní s IIS / ASPONE hostingem (čisté .NET DLL knihovny bez .exe souborů).

## Struktura projektu

- `src/` – React 19 + TypeScript + Tailwind CSS frontend
  - `components/` – UI komponenty (přehrávač, záložky, vyhledávání, modální okna)
  - `contexts/` – AuthContext pro správu relace a JWT tokenů
  - `utils/` – API klienti, YouTube parsery, WebAssembly FFmpeg worker, témata
- `backend/dotnet/` – ASP.NET Core API kontrolery pro KiYoDo (autentizace, databáze `yodo_`, záložky)
- `scripts/` – Pomocné skripty (verzování, automatické navyšování verzí)
- `deploy_ftp.ps1` – Nasazovací skript na FTP (vyžaduje `ftp_credentials.local.ps1`)

## Spuštění lokálně

### Požadavky
- Node.js 20+

### Instalace a start
```bash
# 1. Instalace závislostí
npm install

# 2. Kopie vzorové konfigurace
cp .env.example .env.local

# 3. Spuštění vývojového serveru
npm run dev
```

Aplikace poběží na `http://localhost:3000`.

## Bezpečnost a konfigurace

- Žádná hesla, privátní tokeny ani citlivé klíče nejsou součástí git repozitáře.
- Pro konfiguraci lokálního FTP nasazení zkopírujte `ftp_credentials.example.ps1` do `ftp_credentials.local.ps1` (tento soubor je chráněn v `.gitignore`).
- Pro konfiguraci backendu zkopírujte `backend/dotnet/appsettings.example.json` do `appsettings.json`.
