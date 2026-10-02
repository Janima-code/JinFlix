function CatalogToolbar({
  searchInput,
  onSearchInputChange,
  showSuggestions,
  onSearchFocus,
  onSearchBlur,
  searchSuggestions,
  onSuggestionSelect,
  filterDrawerOpen,
  onToggleFilters,
  selectedGenre,
  onGenreChange,
  genreOptions,
  selectedLanguage,
  onLanguageChange,
  languageOptions,
  minRating,
  onRatingChange,
  tabOptions,
  activeTab,
  onTabChange,
  categories,
  selectedCategory,
  onCategoryChange
}) {
  return (
    <>
      <div className="search-panel">
        <div className="search-input-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="Search by title or genre"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            aria-label="Search movies or series"
          />

          {showSuggestions && searchSuggestions.length > 0 ? (
            <ul className="search-suggestions">
              {searchSuggestions.map((item) => (
                <li key={`${item.mediaType}-${item.id}`}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSuggestionSelect(item)}>
                    <span>{item.Title}</span>
                    <small>{item.mediaType === 'series' ? 'TV' : 'Movie'}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button type="button" className="filter-toggle" onClick={onToggleFilters}>
          {filterDrawerOpen ? 'Hide filters' : 'Show filters'}
        </button>
      </div>

      <div className={`filter-panel ${filterDrawerOpen ? '' : 'closed'}`}>
        <select aria-label="Filter by genre" value={selectedGenre} onChange={(event) => onGenreChange(event.target.value)}>
          {genreOptions.map((genre) => (
            <option key={genre} value={genre}>{genre === 'All' ? 'All genres' : genre}</option>
          ))}
        </select>

        <select aria-label="Filter by language" value={selectedLanguage} onChange={(event) => onLanguageChange(event.target.value)}>
          {languageOptions.map((language) => (
            <option key={language} value={language}>{language === 'All' ? 'All languages' : language}</option>
          ))}
        </select>

        <select aria-label="Filter by rating" value={minRating} onChange={(event) => onRatingChange(event.target.value)}>
          <option value="0">All ratings</option>
          <option value="7">7.0+</option>
          <option value="8">8.0+</option>
          <option value="9">9.0+</option>
        </select>
      </div>

      <div className="tab-row">
        {tabOptions.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? 'category-chip active' : 'category-chip'}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="category-chip-group" style={{ marginTop: '12px' }}>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? 'category-chip active' : 'category-chip'}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </>
  );
}

export default CatalogToolbar;