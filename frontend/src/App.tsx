import { useEffect, useMemo, useState } from 'react';
import { filterTests, isLabTest, toggleTestSelection } from './selection';
import type { LabTest } from './selection';

type RequestStatus = 'loading' | 'success' | 'error';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

export default function App() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setRequestStatus('loading');

    async function loadTests() {
      try {
        const response = await fetch('/api/tests', { signal: controller.signal });
        if (!response.ok) throw new Error(`The lab catalog service is temporarily unavailable`);

        const payload: unknown = await response.json();
        if (!Array.isArray(payload) || !payload.every(isLabTest)) {
          throw new Error('The catalog could not be read');
        }
        if (!controller.signal.aborted) {
          setTests(payload.filter((test) => test.status));
          setRequestStatus('success');
          setErrorMessage('');
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Could not connect to the lab catalog');
        setRequestStatus('error');
      }
    }

    void loadTests();
    return () => controller.abort();
  }, [retryCount]);

  const filteredTests = useMemo(() => filterTests(tests, search), [tests, search]);
  const selectedTests = useMemo(
    () => selectedIds
      .map((id) => tests.find((test) => test.id === id))
      .filter((test): test is LabTest => test !== undefined),
    [tests, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((current) => toggleTestSelection(current, id));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MedEx lab test bundle finder home">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>MedEx <span className="brand-subtle">Labs</span></span>
        </a>
        <span className="topbar-note">Lab Test Bundle Finder</span>
      </header>

      <main className="page">
        <div className="page-intro">
          <div className="kicker"><span className="kicker-dot" /> Simpler health checkups</div>
          <h1>Your tests, one smarter plan.</h1>
          <p>Find the lab tests you need. We'll help you discover the most affordable way to book them together.</p>
        </div>

        <div className="step-indicator" aria-label="Progress: selecting tests">
          <span className="step step-current"><span className="step-number">1</span> Choose tests</span>
          <span className="step-divider" aria-hidden="true" />
          <span className="step step-upcoming"><span className="step-number">2</span> Review best plan</span>
        </div>

        <div className="workspace">
          <section className="panel catalog-panel" aria-labelledby="catalog-title">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Step 01</p>
                <h2 id="catalog-title">Choose your lab tests</h2>
                <p className="section-description">Search by test name or short code, then select what you need.</p>
              </div>
              {requestStatus === 'success' && <span className="count-pill">{tests.length} available</span>}
            </div>

            <div className="search-container">
              <label htmlFor="test-search" className="search-label">Search lab tests</label>
              <div className="search-field">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.2 4.2" />
                </svg>
                <input
                  id="test-search"
                  type="search"
                  autoComplete="off"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Try ‘blood’, ‘TSH’ or ‘kidney’"
                  disabled={requestStatus !== 'success'}
                />
              </div>
            </div>

            {requestStatus === 'loading' && (
              <div className="catalog-message" role="status">
                <span className="spinner" aria-hidden="true" />
                <strong>Loading available tests…</strong>
                <p>Connecting to the lab catalog.</p>
              </div>
            )}

            {requestStatus === 'error' && (
              <div className="catalog-message error-message" role="alert">
                <span className="message-icon" aria-hidden="true">!</span>
                <strong>We couldn't load the lab tests</strong>
                <p>{errorMessage}. Please try again in a moment.</p>
                <button type="button" className="retry-button" onClick={() => setRetryCount((count) => count + 1)}>
                  Try again
                </button>
              </div>
            )}

            {requestStatus === 'success' && (
              <>
                <div className="list-header">
                  <span aria-live="polite">{filteredTests.length} {filteredTests.length === 1 ? 'result' : 'results'}</span>
                  <span>Select any combination</span>
                </div>
                {filteredTests.length === 0 ? (
                  <div className="catalog-message empty-search" role="status">
                    <strong>No matching tests found</strong>
                    <p>Try another name or code.</p>
                    <button type="button" className="text-button" onClick={() => setSearch('')}>Clear search</button>
                  </div>
                ) : (
                  <ul className="test-list" aria-label="Available lab tests">
                    {filteredTests.map((test) => {
                      const isSelected = selectedIds.includes(test.id);
                      return (
                        <li key={test.id}>
                          <button
                            type="button"
                            className={`test-row${isSelected ? ' test-row-selected' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => toggle(test.id)}
                          >
                            <span className={`selection-box${isSelected ? ' selection-box-active' : ''}`} aria-hidden="true">
                              {isSelected ? '✓' : '+'}
                            </span>
                            <span className="test-details">
                              <span className="test-title">{test.name}</span>
                              <span className="test-code">{test.code}</span>
                            </span>
                            <span className="test-price">{test.price === null ? <span className="package-only">Package only</span> : money.format(test.price)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          <aside className="panel selection-panel" aria-labelledby="selection-title">
            <div className="selection-topline">
              <p className="section-eyebrow">Your selection</p>
              <span className="selection-count" aria-live="polite">{selectedTests.length} selected</span>
            </div>
            <h2 id="selection-title">Your test list</h2>
            {selectedTests.length === 0 ? (
              <div className="selection-empty">
                <div className="empty-symbol" aria-hidden="true">+</div>
                <strong>Nothing selected yet</strong>
                <p>Choose a test from the catalog to build your list.</p>
              </div>
            ) : (
              <>
                <ul className="selected-list" aria-label="Selected lab tests">
                  {selectedTests.map((test) => (
                    <li key={test.id} className="selected-item">
                      <span className="selected-item-content"><strong>{test.name}</strong><small>{test.code}</small></span>
                      <button
                        type="button"
                        className="remove-button"
                        onClick={() => toggle(test.id)}
                        aria-label={`Remove ${test.name}`}
                        title={`Remove ${test.name}`}
                      >×</button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="clear-button" onClick={() => setSelectedIds([])}>
                  Clear all tests
                </button>
              </>
            )}

            <div className="upcoming-plan">
              <span className="upcoming-label">Next step</span>
              <strong>Best-value bundle plan</strong>
              <p>Live price optimization and savings will appear here once the planner is connected in the next milestone.</p>
            </div>
          </aside>
        </div>
        <footer className="footer">MedEx technical assessment · Prices shown in Thai baht (THB)</footer>
      </main>
    </div>
  );
}
