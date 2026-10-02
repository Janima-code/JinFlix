import { useState } from 'react';

export default function CatalogToolbar({
  searchQuery,
  onSearchChange,
  suggestions = [],
  onSelectSuggestion,
  filters,
  onFilterChange,
  genres = [],
  languages = [],
  tabs = [],
  activeTab,
  onTabChange
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="catalog-toolbar">
      {/* 1. Search Bar & Drawer Toggle */}
      <div className="search-panel">
        <div className="search-input-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />

          {suggestions.length > 0 && (
            <ul className="search-suggestions">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelectSuggestion(item)}>
                    <span>{item.title}</span>
                    <small>{item.type === 'tv' ? 'TV' : 'Movie'}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      {/* 2. Filter Dropdowns */}
      {showFilters && (
        <div className="filter-panel">
          <select
            value={filters.genre}
            onChange={(e) => onFilterChange('genre', e.target.value)}
          >
            <option value="All">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={filters.language}
            onChange={(e) => onFilterChange('language', e.target.value)}
          >
            <option value="All">All languages</option>
            {languages.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            value={filters.minRating}
            onChange={(e) => onFilterChange('minRating', e.target.value)}
          >
            <option value="0">All ratings</option>
            <option value="7">7.0+</option>
            <option value="8">8.0+</option>
            <option value="9">9.0+</option>
          </select>
        </div>
      )}

      {/* 3. Category / Tab Chips */}
      {tabs.length > 0 && (
        <div className="tab-row">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`category-chip ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}