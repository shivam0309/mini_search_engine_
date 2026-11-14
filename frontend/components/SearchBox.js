'use client';

import { useEffect, useRef } from 'react';
import { SearchIcon } from './Icons';

// A plain GET form: submitting goes to /search?q=... so it works without JavaScript too.
// Press "/" anywhere on the page to jump to the box.
export default function SearchBox({ defaultValue = '', large = false, autoFocus = false }) {
  const inputRef = useRef(null);

  useEffect(() => {
    function onKey(event) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form action="/search" method="get" role="search" className={`searchbox${large ? ' large' : ''}`}>
      <SearchIcon size={large ? 22 : 19} />
      <label htmlFor={large ? 'q-home' : 'q'} className="visually-hidden">
        Search the index
      </label>
      <input
        ref={inputRef}
        id={large ? 'q-home' : 'q'}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={large ? 'Search pages, e.g. how does pagerank work' : 'Search'}
        autoComplete="off"
        autoFocus={autoFocus}
        required
        maxLength={200}
      />
      {large ? (
        <button type="submit" className="button">
          Search
        </button>
      ) : (
        <kbd className="key" title="Press / to search">
          /
        </kbd>
      )}
    </form>
  );
}
