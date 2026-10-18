import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  Clock, 
  Eye, 
  User, 
  Download, 
  Music, 
  Play, 
  Copy, 
  Check, 
  X,
  ExternalLink,
  Flame,
  Film,
  Bot,
  BookOpen,
  Headphones,
  Rocket,
  Laugh,
  Calendar,
  ArrowDown,
  Palette,
  Guitar,
  Bookmark
} from 'lucide-react';
import { Language, translations } from '../utils/translations';
import { VideoSearchResult, UserPreferences, DurationFilter } from '../types';
import { 
  searchYouTubeVideos, 
  fetchSearchSuggestions, 
  parseRelativeTimeToSeconds,
  matchesDurationFilter 
} from '../utils/youtube';
import { AddToBookmarkModal } from './AddToBookmarkModal';

interface YouTubeSearchProps {
  lang: Language;
  preferences: UserPreferences;
  onSelectVideo: (url: string, preferredFormat?: 'mp3' | 'mp4') => void;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
}

export interface SearchCategoryItem {
  id: string;
  label: string;
  query: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const SEARCH_STORAGE_KEY = 'kiyodo_last_search_state';

interface CachedSearchState {
  query: string;
  results: VideoSearchResult[];
  continuation: string | null;
  sortBy: 'date' | 'relevance';
  durationFilter?: DurationFilter;
  hasSearched: boolean;
}

const getCachedSearchState = (): CachedSearchState | null => {
  try {
    const raw = sessionStorage.getItem(SEARCH_STORAGE_KEY) || localStorage.getItem(SEARCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.query === 'string' && Array.isArray(parsed.results)) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return null;
};

export const DURATION_FILTERS: { id: DurationFilter; labelKey: keyof typeof translations.cs; range: string }[] = [
  { id: 'all', labelKey: 'searchDurationAll', range: '' },
  { id: '0-4', labelKey: 'searchDuration0_4', range: '0–4 min' },
  { id: '4-8', labelKey: 'searchDuration4_8', range: '4–8 min' },
  { id: '8-16', labelKey: 'searchDuration8_16', range: '8–16 min' },
  { id: '16-50', labelKey: 'searchDuration16_50', range: '16–50 min' },
  { id: '50+', labelKey: 'searchDuration50Plus', range: '50+ min' },
];

const SEARCH_CATEGORIES_CS: SearchCategoryItem[] = [
  { id: 'ai', label: 'AI novinky', query: 'AI novinky', icon: Bot, description: 'Umělá inteligence, novinky a trendy' },
  { id: 'pohadky', label: 'Pohádky', query: 'Pohádky', icon: BookOpen, description: 'Klasické i hrané české pohádky' },
  { id: 'pohadky-kreslene', label: 'Pohádky kreslené', query: 'Pohádky kreslené', icon: Palette, description: 'Kreslené a animované večerníčky pro děti' },
  { id: 'pohadky-audio', label: 'Pohádky audio', query: 'Pohádky audio', icon: Headphones, description: 'Mluvené pohádky a večerníčky na poslech' },
  { id: 'scifi', label: 'Sci-Fi', query: 'Sci-Fi', icon: Rocket, description: 'Sci-fi filmy, vesmír a technologie' },
  { id: 'scenky', label: 'Vtipné scénky', query: 'Vtipné scénky', icon: Laugh, description: 'Zábavné skeče, humor a komedie' },
  { id: 'symphonic-metal', label: 'Symphonic metal', query: 'Symphonic metal', icon: Guitar, description: 'Symfonický metal, epická hudba a koncerty' },
];

const SEARCH_CATEGORIES_EN: SearchCategoryItem[] = [
  { id: 'ai', label: 'AI News', query: 'AI news', icon: Bot, description: 'Artificial intelligence updates & tech' },
  { id: 'pohadky', label: 'Fairy Tales', query: 'Fairy tales', icon: BookOpen, description: 'Classic tales and animations' },
  { id: 'pohadky-kreslene', label: 'Cartoon Fairy Tales', query: 'Animated fairy tales', icon: Palette, description: 'Cartoons and animated stories for kids' },
  { id: 'pohadky-audio', label: 'Audio Fairy Tales', query: 'Audio fairy tales', icon: Headphones, description: 'Spoken stories and bedtime audiobooks' },
  { id: 'scifi', label: 'Sci-Fi', query: 'Sci-Fi', icon: Rocket, description: 'Science fiction, space & universe' },
  { id: 'scenky', label: 'Funny Sketches', query: 'Funny sketches', icon: Laugh, description: 'Comedy sketches, jokes & humor' },
  { id: 'symphonic-metal', label: 'Symphonic Metal', query: 'Symphonic metal', icon: Guitar, description: 'Epic symphonic metal and live concerts' },
];

export const YouTubeSearch: React.FC<YouTubeSearchProps> = ({
  lang,
  onSelectVideo,
  initialQuery = '',
  onQueryChange,
}) => {
  const t = translations[lang];
  const [cachedState] = useState<CachedSearchState | null>(getCachedSearchState);

  const [query, setQuery] = useState(() => initialQuery || cachedState?.query || '');
  const [results, setResults] = useState<VideoSearchResult[]>(() => cachedState?.results || []);
  const [continuation, setContinuation] = useState<string | null>(() => cachedState?.continuation ?? null);
  const [sortBy, setSortBy] = useState<'date' | 'relevance'>(() => cachedState?.sortBy || 'date');
  const [durationFilter, setDurationFilter] = useState<DurationFilter>(() => cachedState?.durationFilter || 'all');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState<boolean>(() => cachedState?.hasSearched || (Boolean(cachedState?.results?.length)));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preview modal state
  const [previewVideo, setPreviewVideo] = useState<VideoSearchResult | null>(null);
  const [bookmarkVideo, setBookmarkVideo] = useState<VideoSearchResult | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  const categories = lang === 'cs' ? SEARCH_CATEGORIES_CS : SEARCH_CATEGORIES_EN;

  const durationCounts = useMemo(() => {
    const counts: Record<DurationFilter, number> = {
      'all': results.length,
      '0-4': 0,
      '4-8': 0,
      '8-16': 0,
      '16-50': 0,
      '50+': 0,
    };
    for (const v of results) {
      for (const f of ['0-4', '4-8', '8-16', '16-50', '50+'] as const) {
        if (matchesDurationFilter(v, f)) {
          counts[f]++;
        }
      }
    }
    return counts;
  }, [results]);

  const filteredResults = useMemo(() => {
    if (durationFilter === 'all') return results;
    return results.filter((video) => matchesDurationFilter(video, durationFilter));
  }, [results, durationFilter]);

  const saveSearchState = (stateToSave: Partial<CachedSearchState>) => {
    try {
      const current: CachedSearchState = {
        query: stateToSave.query !== undefined ? stateToSave.query : query,
        results: stateToSave.results !== undefined ? stateToSave.results : results,
        continuation: stateToSave.continuation !== undefined ? stateToSave.continuation : continuation,
        sortBy: stateToSave.sortBy !== undefined ? stateToSave.sortBy : sortBy,
        durationFilter: stateToSave.durationFilter !== undefined ? stateToSave.durationFilter : durationFilter,
        hasSearched: stateToSave.hasSearched !== undefined ? stateToSave.hasSearched : hasSearched,
      };
      const serialized = JSON.stringify(current);
      sessionStorage.setItem(SEARCH_STORAGE_KEY, serialized);
      localStorage.setItem(SEARCH_STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  };

  // Auto-search on initialQuery if provided and not already cached
  useEffect(() => {
    if (initialQuery.trim()) {
      if (initialQuery.trim() === cachedState?.query && (cachedState?.results?.length ?? 0) > 0) {
        return;
      }
      setQuery(initialQuery.trim());
      handleSearch(initialQuery.trim(), 'date');
    }
  }, [initialQuery]);

  // Autocomplete fetch on query change with debounce
  useEffect(() => {
    const trimmed = query.trim();
    const isUrl = 
      trimmed.startsWith('http://') || 
      trimmed.startsWith('https://') || 
      trimmed.includes('youtube.com') || 
      trimmed.includes('youtu.be') || 
      trimmed.includes('tiktok.com') || 
      trimmed.includes('instagram.com') || 
      trimmed.includes('facebook.com') || 
      trimmed.includes('fb.watch') || 
      /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

    if (!trimmed || trimmed.length < 2 || isUrl) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const list = await fetchSearchSuggestions(trimmed);
        setSuggestions(list.slice(0, 8));
      } catch {
        // silent
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string, sort: 'date' | 'relevance' = sortBy) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setShowSuggestions(false);
    setIsLoading(true);
    setErrorMessage(null);
    setHasSearched(true);
    setContinuation(null);

    try {
      const response = await searchYouTubeVideos(trimmed, null, sort, lang);
      let list = response.results;
      if (sort === 'date') {
        list = list.slice().sort((a, b) => {
          return parseRelativeTimeToSeconds(a.publishedTime || a.uploadDate) - parseRelativeTimeToSeconds(b.publishedTime || b.uploadDate);
        });
      }
      setResults(list);
      setContinuation(response.continuation || null);
      saveSearchState({
        query: trimmed,
        results: list,
        continuation: response.continuation || null,
        sortBy: sort,
        hasSearched: true,
      });
      onQueryChange?.(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chyba při vyhledávání videí';
      setErrorMessage(msg);
      setResults([]);
      setContinuation(null);
      saveSearchState({
        query: trimmed,
        results: [],
        continuation: null,
        sortBy: sort,
        hasSearched: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!continuation || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const response = await searchYouTubeVideos(query, continuation, sortBy, lang);
      let combinedResults: VideoSearchResult[] = [];
      setResults((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const newItems = response.results.filter((v) => !existingIds.has(v.id));
        const combined = [...prev, ...newItems];
        if (sortBy === 'date') {
          combinedResults = combined.slice().sort((a, b) => {
            return parseRelativeTimeToSeconds(a.publishedTime || a.uploadDate) - parseRelativeTimeToSeconds(b.publishedTime || b.uploadDate);
          });
        } else {
          combinedResults = combined;
        }
        return combinedResults;
      });
      const newContinuation = response.continuation || null;
      setContinuation(newContinuation);
      saveSearchState({
        results: combinedResults.length > 0 ? combinedResults : undefined,
        continuation: newContinuation,
      });
    } catch {
      // keep existing results
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSortChange = (newSort: 'date' | 'relevance') => {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    saveSearchState({ sortBy: newSort });
    if (query.trim()) {
      handleSearch(query, newSort);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggested: string) => {
    setQuery(suggested);
    setShowSuggestions(false);
    handleSearch(suggested);
  };

  const handleCopyLink = async (e: React.MouseEvent, video: VideoSearchResult) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(video.url);
      setCopiedId(video.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Search Header Banner */}
      <div className="text-center max-w-2xl mx-auto">
        <div 
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border"
          style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}
        >
          <Flame className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <span>YouTube Live Search</span>
        </div>
        <h2 
          className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          {t.searchTitle}
        </h2>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t.searchSubtitle}
        </p>
      </div>

      {/* Main Search Input & Autocomplete Dropdown */}
      <div className="relative max-w-3xl mx-auto">
        <div 
          className="relative flex items-center border rounded-2xl p-1.5 shadow-lg transition-all"
          style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        >
          <div className="pl-3.5" style={{ color: 'var(--accent-primary)' }}>
            <Search className="w-5 h-5" />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.searchPlaceholder}
            className="flex-1 bg-transparent px-3 py-3 text-sm sm:text-base focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                setShowSuggestions(false);
                setResults([]);
                setHasSearched(false);
                setContinuation(null);
                saveSearchState({ query: '', results: [], continuation: null, hasSearched: false });
                onQueryChange?.('');
                searchInputRef.current?.focus();
              }}
              className="p-1.5 rounded-md transition-colors mr-1 cursor-pointer hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title="Smazat"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSearch(query)}
            disabled={!query.trim() || isLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-md disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            style={{
              backgroundColor: !query.trim() || isLoading ? 'var(--panel-surface)' : 'var(--accent-primary)',
              color: !query.trim() || isLoading ? 'var(--text-muted)' : 'var(--accent-contrast)',
              opacity: !query.trim() || isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">{t.searchLoading}</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{t.searchBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* Real-time YouTube Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsBoxRef}
            className="absolute left-0 right-0 top-full mt-2 border rounded-xl shadow-2xl z-50 overflow-hidden divide-y"
            style={{ 
              backgroundColor: 'var(--panel-bg)', 
              borderColor: 'var(--panel-border)',
              boxShadow: 'var(--panel-shadow)'
            }}
          >
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors cursor-pointer group hover:opacity-90"
                style={{ 
                  color: 'var(--text-primary)',
                  borderBottomColor: 'var(--panel-border)'
                }}
              >
                <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        )}

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs px-1">
          <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t.searchQuickChips}
          </span>
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setQuery(cat.query);
                  handleSearch(cat.query);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer hover:opacity-85 hover:border-amber-500/50 shadow-xs"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)'
                }}
              >
                <IconComponent className="w-3.5 h-3.5 text-amber-500" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="max-w-3xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm text-center">
          {errorMessage}
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl mx-auto pt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs animate-pulse"
            >
              <div className="aspect-video bg-slate-200 dark:bg-slate-800 w-full" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Results Grid */}
      {!isLoading && hasSearched && results.length > 0 && (
        <div className="space-y-4 max-w-6xl mx-auto">
          {/* Top Controls: Title, Counts, Sorting and Duration Filters */}
          <div className="flex flex-col gap-3 px-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>{t.searchResultsFor}</span>
                <span className="text-amber-500 font-bold">"{query}"</span>
                <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {durationFilter === 'all'
                    ? `${results.length} videí`
                    : `${filteredResults.length} z ${results.length} videí`}
                </span>
              </h3>

              {/* Sort Toggle: Od nejnovějších (default) / Dle relevance */}
              <div className="inline-flex items-center rounded-xl p-0.5 border text-xs" style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}>
                <button
                  type="button"
                  onClick={() => handleSortChange('date')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    sortBy === 'date' 
                      ? 'bg-amber-500 text-white shadow-xs font-bold' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Řadit od nejnovějších videí po nejstarší"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t.searchSortDate}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSortChange('relevance')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    sortBy === 'relevance' 
                      ? 'bg-amber-500 text-white shadow-xs font-bold' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Řadit dle relevance YouTube algoritmu"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{t.searchSortRelevance}</span>
                </button>
              </div>
            </div>

            {/* Duration Filter Chips */}
            <div 
              className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl border text-xs shadow-xs"
              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
            >
              <span className="flex items-center gap-1 font-semibold mr-1 pl-1" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.searchFilterDuration}</span>
              </span>
              {DURATION_FILTERS.map((f) => {
                const count = durationCounts[f.id];
                const isActive = durationFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setDurationFilter(f.id);
                      saveSearchState({ durationFilter: f.id });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-xs'
                        : count === 0
                          ? 'opacity-40 hover:opacity-75 hover:border-amber-500/30'
                          : 'hover:border-amber-500/50'
                    }`}
                    style={!isActive ? {
                      backgroundColor: 'var(--panel-bg)',
                      borderColor: 'var(--panel-border)',
                      color: 'var(--text-primary)'
                    } : undefined}
                    title={f.id === 'all' ? t.searchDurationAll : `Filtrovat videa o délce ${f.range}`}
                  >
                    <span>{t[f.labelKey]}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-black/25 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-400'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Empty state when duration filter matches 0 videos */}
          {filteredResults.length === 0 ? (
            <div 
              className="max-w-md mx-auto text-center py-10 px-5 rounded-2xl border my-4"
              style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
            >
              <Clock className="w-10 h-10 mx-auto mb-3 text-amber-500 opacity-80" />
              <h4 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                {t.searchNoDurationMatch}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {lang === 'cs'
                  ? `V rozsahu ${DURATION_FILTERS.find(f => f.id === durationFilter)?.range || ''} není žádné video z aktuálně načtených ${results.length} výsledků.`
                  : `No videos found in this range among the ${results.length} loaded results.`}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDurationFilter('all');
                    saveSearchState({ durationFilter: 'all' });
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {t.searchDurationAll}
                </button>
                {continuation && (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:opacity-85 transition-opacity"
                    style={{ borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }}
                  >
                    {isLoadingMore ? t.searchLoadingMore : t.searchLoadMore}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredResults.map((video) => (
              <div
                key={video.id}
                className="group flex flex-col border hover:border-slate-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-200"
                style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
              >
                {/* Video Thumbnail with duration overlay */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Duration Badge */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono font-medium text-white shadow-md flex items-center gap-1 backdrop-blur-xs">
                      <Clock className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
                      <span>{video.duration}</span>
                    </div>
                  )}

                  {/* Hover Quick Preview Button */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewVideo(video)}
                      className="p-3 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-xl transform scale-90 group-hover:scale-100 transition-all cursor-pointer"
                      title="Přehrát náhled"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4
                      className="font-bold text-sm line-clamp-2 leading-snug transition-colors"
                      style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                      title={video.title}
                    >
                      {video.title}
                    </h4>

                    {/* Channel & Metadata with Datum vydání */}
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
                        <User className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="truncate">{video.author}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {/* Datum vydání - zvýrazněný badge */}
                        {(video.publishedTime || video.uploadDate) && (
                          <span 
                            className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
                            title={`Datum vydání: ${video.publishedTime || video.uploadDate}`}
                          >
                            <Calendar className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{video.publishedTime || video.uploadDate}</span>
                          </span>
                        )}

                        {video.viewCount && (
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3 opacity-70" />
                            {video.viewCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t flex flex-col gap-2" style={{ borderTopColor: 'var(--panel-border)' }}>
                    <div className="flex items-center gap-1.5">
                      {/* Main Download & Convert Button */}
                      <button
                        type="button"
                        onClick={() => onSelectVideo(video.url)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                        style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-contrast)' }}
                        title={t.searchDownloadBtn}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t.searchDownloadBtn}</span>
                      </button>

                      {/* Quick MP3 Button */}
                      <button
                        type="button"
                        onClick={() => onSelectVideo(video.url, 'mp3')}
                        className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer border"
                        style={{
                          backgroundColor: 'var(--panel-surface)',
                          borderColor: 'var(--panel-border)',
                          color: 'var(--text-primary)'
                        }}
                        title="Okamžitě převést na MP3"
                      >
                        <Music className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                        <span>MP3</span>
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, video)}
                        className="p-2 rounded-xl transition-colors cursor-pointer border"
                        style={{
                          backgroundColor: 'var(--panel-surface)',
                          borderColor: 'var(--panel-border)',
                          color: 'var(--text-muted)'
                        }}
                        title={copiedId === video.id ? t.searchLinkCopied : t.searchCopyLink}
                      >
                        {copiedId === video.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Add to Bookmark Button */}
                      <button
                        type="button"
                        onClick={() => setBookmarkVideo(video)}
                        className="p-2 rounded-xl transition-colors cursor-pointer border hover:bg-white/10"
                        style={{
                          backgroundColor: 'var(--panel-surface)',
                          borderColor: 'var(--panel-border)',
                          color: 'var(--accent-primary)'
                        }}
                        title={lang === 'cs' ? 'Uložit do záložek' : 'Save to bookmarks'}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Pagination / Load More Button */}
          {continuation && (
            <div className="flex flex-col items-center justify-center pt-8 pb-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-6 py-3 rounded-2xl border font-bold text-sm flex items-center gap-2.5 transition-all hover:scale-105 shadow-md cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--panel-surface)',
                  borderColor: 'var(--panel-border)',
                  color: 'var(--text-primary)'
                }}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    <span>{t.searchLoadingMore}</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4 text-amber-500" />
                    <span>{t.searchLoadMore}</span>
                  </>
                )}
              </button>
              <span className="mt-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {durationFilter === 'all'
                  ? `${t.searchShowingVideos}: ${results.length} videí`
                  : `${t.searchShowingVideos}: ${filteredResults.length} z ${results.length} videí`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* No Results Empty State */}
      {!isLoading && hasSearched && results.length === 0 && (
        <div 
          className="max-w-md mx-auto text-center py-12 px-4 rounded-2xl border"
          style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
        >
          <Film className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h4 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            {t.searchNoResults}
          </h4>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {lang === 'cs' 
              ? 'Zkuste zadat jiný název skladby, jméno autora nebo zvolte některou z kategorií výše.'
              : 'Try searching for another song, artist, or choose one of the categories above.'}
          </p>
        </div>
      )}

      {/* Initial Landing State when no search executed yet */}
      {!hasSearched && (
        <div className="max-w-4xl mx-auto py-8 text-center">
          <div 
            className="p-8 sm:p-10 rounded-3xl border shadow-xs"
            style={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
          >
            <div 
              className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--panel-surface)', borderColor: 'var(--panel-border)', color: 'var(--accent-primary)' }}
            >
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              {lang === 'cs' ? 'Vyberte kategorii nebo začněte hledat' : 'Choose a category or start searching'}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {lang === 'cs'
                ? 'Klikněte na libovolnou kategorii níže nebo zadejte vlastní výraz do pole výše. Každé video můžete jedním kliknutím stáhnout jako MP3 nebo MP4.'
                : 'Click any category below or enter your own search term above. Each video can be downloaded directly as MP3 or MP4.'}
            </p>

            {/* Visual category cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mt-6 text-left">
              {categories.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setQuery(cat.query);
                      handleSearch(cat.query);
                    }}
                    className="group flex flex-col p-4 rounded-2xl border transition-all hover:scale-102 hover:shadow-md cursor-pointer text-left relative overflow-hidden"
                    style={{
                      backgroundColor: 'var(--panel-surface)',
                      borderColor: 'var(--panel-border)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{ 
                        backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                        color: '#f59e0b' 
                      }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-sm mb-1 group-hover:text-amber-500 transition-colors">
                      {cat.label}
                    </div>
                    {cat.description && (
                      <div className="text-[11px] leading-tight line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {cat.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl text-white">
            {/* Modal Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="truncate mr-4">
                <h4 className="font-bold text-sm sm:text-base text-white truncate">
                  {previewVideo.title}
                </h4>
                <p className="text-xs text-slate-400 truncate">{previewVideo.author}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Embedded Player */}
            <div className="aspect-video w-full bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${previewVideo.id}?autoplay=1`}
                title={previewVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 font-mono">
                {previewVideo.duration && <span>Délka: {previewVideo.duration}</span>}
                {(previewVideo.publishedTime || previewVideo.uploadDate) && (
                  <span>· {t.searchPublished}: {previewVideo.publishedTime || previewVideo.uploadDate}</span>
                )}
                {previewVideo.viewCount && <span>· {previewVideo.viewCount}</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const u = previewVideo.url;
                    setPreviewVideo(null);
                    onSelectVideo(u, 'mp3');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  <Music className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>Stáhnout MP3</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const u = previewVideo.url;
                    setPreviewVideo(null);
                    onSelectVideo(u);
                  }}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:opacity-90"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Stáhnout / Převést</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Modal */}
      {bookmarkVideo && (
        <AddToBookmarkModal
          isOpen={true}
          onClose={() => setBookmarkVideo(null)}
          video={bookmarkVideo}
          lang={lang}
        />
      )}
    </div>
  );
};
