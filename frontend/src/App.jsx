import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import Dashboard from './Dashboard';

function getUserIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ? String(payload.sub) : '';
  } catch {
    return '';
  }
}

const NAV = [
  ['home', 'Home'],
  ['events', 'Explore'],
  ['ai', 'AI Studio'],
  ['reviews', 'Reviews'],
  ['dashboard', 'Insights'],
];

export default function App() {
  const [page, setPage] = useState('home');
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [toast, setToast] = useState(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('eventhub_token') || '');
  const [userId, setUserId] = useState(() => localStorage.getItem('eventhub_userId') || '');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const [bookingLoading, setBookingLoading] = useState(false);
  const [lastBooking, setLastBooking] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eventhub_lastBooking') || 'null'); }
    catch { return null; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('eventhub_notifications') || '[]'); }
    catch { return []; }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [aiText, setAiText] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [reviewText, setReviewText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    localStorage.setItem('eventhub_notifications', JSON.stringify(notifications));
  }, [notifications]);

  async function loadCatalog() {
    try {
      setLoading(true);
      setCatalogError('');
      const data = await api.catalog();
      setCatalog(Array.isArray(data) ? data : []);
    } catch (err) {
      setCatalogError(err.message || 'Could not load events.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage('');

    try {
      const result = authMode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password);

      if (!result?.token) throw new Error('No token received from server.');

      const newToken = result.token;
      const newUserId = getUserIdFromToken(newToken);
      if (!newUserId) throw new Error('Could not extract user ID from token.');

      localStorage.setItem('eventhub_token', newToken);
      localStorage.setItem('eventhub_userId', newUserId);
      setToken(newToken);
      setUserId(newUserId);
      setAuthMessage(authMode === 'login' ? 'Welcome back.' : 'Your EventHub account is ready.');

      setTimeout(() => {
        setAuthOpen(false);
        setPage('events');
        setAuthMessage('');
      }, 700);
    } catch (err) {
      setAuthMessage(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('eventhub_token');
    localStorage.removeItem('eventhub_userId');
    setToken('');
    setUserId('');
    setToast({ type: 'info', title: 'Signed out', text: 'Your EventHub session has ended.' });
  }

  async function handleBooking(event) {
    if (!token || !userId) {
      setSelectedEvent(null);
      setAuthOpen(true);
      setAuthMode('login');
      setAuthMessage('Log in to reserve your seat.');
      return;
    }

    setBookingLoading(true);
    try {
      const result = await api.book(userId, event.id, token);
      const booking = { ...result, eventId: event.id, eventTitle: event.title, price: event.price };
      localStorage.setItem('eventhub_lastBooking', JSON.stringify(booking));
      setLastBooking(booking);

      const notification = {
        id: Date.now(),
        title: 'Booking confirmed',
        text: `${event.title} is now in your tickets.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications((current) => [notification, ...current].slice(0, 8));
      setSelectedEvent(null);
      setToast({ type: 'success', title: 'Seat reserved', text: `Booking #${result.id} confirmed.` });
      setPage('reviews');
    } catch (err) {
      setToast({ type: 'error', title: 'Booking failed', text: err.message || 'Please try again.' });
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiResult(null);

    try {
      const result = await api.analyze(aiText.trim());
      setAiResult({
        sentiment: result.sentiment || 'neutral',
        summary: result.summary || aiText.trim(),
      });
    } catch (err) {
      setAiResult({ error: err.message || 'AI service is unavailable.' });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleReview(e) {
    e.preventDefault();
    const bookingId = lastBooking?.id || localStorage.getItem('eventhub_bookingId');

    if (!token) {
      setAuthOpen(true);
      setAuthMessage('Log in before publishing a review.');
      return;
    }
    if (!bookingId) {
      setReviewMessage('Book an event first, then your review will be attached to that booking.');
      return;
    }
    if (!reviewText.trim()) {
      setReviewMessage('Write a few words about your experience.');
      return;
    }

    setReviewLoading(true);
    setReviewMessage('');
    try {
      await api.review(bookingId, reviewText.trim(), token);
      setReviewText('');
      setReviewMessage('Review published. Thank you for helping the community.');
      setToast({ type: 'success', title: 'Review published', text: 'Your feedback was added successfully.' });
    } catch (err) {
      setReviewMessage(err.message || 'Could not publish the review.');
    } finally {
      setReviewLoading(false);
    }
  }

  function go(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const featured = useMemo(() => catalog.slice(0, 3), [catalog]);
  const totalValue = useMemo(
      () => catalog.reduce((sum, event) => sum + Number(event.price || 0), 0),
      [catalog]
  );

  return (
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => go('home')} aria-label="EventHub home">
            Event<span>Hub</span>
          </button>

          <nav className="desktop-nav">
            {NAV.map(([id, label]) => (
                <button key={id} className={page === id ? 'nav-link active' : 'nav-link'} onClick={() => go(id)}>
                  {label}
                </button>
            ))}
          </nav>

          <div className="top-actions">
            <button
                className="icon-button notification-button"
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label="Notifications"
            >
              <span>◌</span>
              {notifications.length > 0 && <b>{notifications.length}</b>}
            </button>

            {userId ? (
                <button className="profile-chip" onClick={() => go('account')}>
                  <span className="avatar">{email?.charAt(0).toUpperCase() || 'U'}</span>
                  <span className="profile-email">{email || 'Member'}</span>
                </button>
            ) : (
                <button className="nav-cta" onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
          </div>

          {notificationsOpen && (
              <div className="notification-panel">
                <div className="panel-head">
                  <div><span className="eyebrow">INBOX</span><h3>Notifications</h3></div>
                  <button onClick={() => setNotifications([])}>Clear</button>
                </div>
                {notifications.length === 0 ? (
                    <div className="notification-empty">You're all caught up.</div>
                ) : notifications.map((item) => (
                    <div className="notification-item" key={item.id}>
                      <span className="notification-dot" />
                      <div><strong>{item.title}</strong><p>{item.text}</p><small>{item.time}</small></div>
                    </div>
                ))}
              </div>
          )}
        </header>

        <main>
          {page === 'home' && (
              <HomePage
                  featured={featured}
                  loading={loading}
                  totalEvents={catalog.length}
                  totalValue={totalValue}
                  userId={userId}
                  onExplore={() => go('events')}
                  onSelect={setSelectedEvent}
              />
          )}

          {page === 'events' && (
              <ExplorePage
                  catalog={catalog}
                  loading={loading}
                  error={catalogError}
                  onRetry={loadCatalog}
                  onSelect={setSelectedEvent}
                  onBook={handleBooking}
              />
          )}

          {page === 'ai' && (
              <AIPage
                  aiText={aiText}
                  setAiText={setAiText}
                  aiResult={aiResult}
                  aiLoading={aiLoading}
                  onAnalyze={handleAnalyze}
              />
          )}

          {page === 'reviews' && (
              <ReviewPage
                  token={token}
                  lastBooking={lastBooking}
                  reviewText={reviewText}
                  setReviewText={setReviewText}
                  reviewMessage={reviewMessage}
                  reviewLoading={reviewLoading}
                  onSubmit={handleReview}
                  onLogin={() => setAuthOpen(true)}
                  onExplore={() => go('events')}
              />
          )}

          {page === 'account' && (
              <AccountPage
                  userId={userId}
                  email={email}
                  lastBooking={lastBooking}
                  onLogin={() => setAuthOpen(true)}
                  onLogout={logout}
                  onExplore={() => go('events')}
              />
          )}

          {page === 'dashboard' && <Dashboard />}
        </main>

        <footer className="footer">
          <div>
            <button className="brand footer-brand" onClick={() => go('home')}>Event<span>Hub</span></button>
            <p>A sharper way to discover, reserve and understand live events.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => go('events')}>Explore events</button>
            <button onClick={() => go('ai')}>AI Studio</button>
            <button onClick={() => go('dashboard')}>Insights</button>
          </div>
          <span className="footer-copy">EVENTHUB · PHASE 2</span>
        </footer>

        {selectedEvent && (
            <EventModal
                event={selectedEvent}
                loading={bookingLoading}
                onClose={() => setSelectedEvent(null)}
                onBook={handleBooking}
            />
        )}

        {authOpen && (
            <AuthModal
                mode={authMode}
                setMode={setAuthMode}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                loading={authLoading}
                message={authMessage}
                onSubmit={handleAuth}
                onClose={() => { setAuthOpen(false); setAuthMessage(''); }}
            />
        )}

        {toast && (
            <div className={`toast toast-${toast.type}`}>
              <span className="toast-mark">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}</span>
              <div><strong>{toast.title}</strong><p>{toast.text}</p></div>
              <button onClick={() => setToast(null)}>×</button>
            </div>
        )}

        <div className="mobile-nav">
          {NAV.slice(0, 4).map(([id, label]) => (
              <button key={id} className={page === id ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => go(id)}>
                <span>{id === 'home' ? '⌂' : id === 'events' ? '◇' : id === 'ai' ? '✦' : '☆'}</span>
                {label}
              </button>
          ))}
        </div>
      </div>
  );
}

function HomePage({ featured, loading, totalEvents, totalValue, userId, onExplore, onSelect }) {
  return (
      <div className="home-page">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow-row"><span className="eyebrow">THE EVENT DISCOVERY PLATFORM</span><span className="live-pill"><i /> LIVE</span></div>
            <h1>Make tonight<br /><em>worth remembering.</em></h1>
            <p>Discover standout events, reserve your seat in seconds, and turn every experience into something worth talking about.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={onExplore}>Explore events <span>→</span></button>
              <span className="hero-note"><strong>{totalEvents || '—'}</strong> live listings</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="hero-card hero-card-main">
              <span className="mini-label">TONIGHT'S PICK</span>
              <strong>{featured[0]?.title || 'Something memorable'}</strong>
              <span>{featured[0] ? `$${Number(featured[0].price).toFixed(0)} · Admit one` : 'Curated for you'}</span>
              <button onClick={() => featured[0] && onSelect(featured[0])}>View event ↗</button>
            </div>
            <div className="floating-card floating-top"><span>01</span><strong>Curated</strong><small>less noise, better nights</small></div>
            <div className="floating-card floating-bottom"><span>✦</span><strong>AI powered</strong><small>feedback that actually tells a story</small></div>
          </div>
        </section>

        <section className="marquee">
          <span>DISCOVER</span><b>✦</b><span>BOOK</span><b>✦</b><span>EXPERIENCE</span><b>✦</b><span>REVIEW</span><b>✦</b><span>DISCOVER</span><b>✦</b><span>BOOK</span>
        </section>

        <section className="section featured-section">
          <div className="section-heading">
            <div><span className="eyebrow">HANDPICKED</span><h2>Events with a point of view.</h2></div>
            <button className="text-link" onClick={onExplore}>See all events →</button>
          </div>

          {loading ? <SkeletonCards /> : (
              <div className="featured-grid">
                {featured.map((event, index) => (
                    <article className={`featured-card card-${index + 1}`} key={event.id} onClick={() => onSelect(event)}>
                      <div className="card-number">0{index + 1}</div>
                      <div className="featured-icon">{index === 0 ? '✦' : index === 1 ? '◈' : '○'}</div>
                      <span className="card-tag">LIVE EVENT</span>
                      <h3>{event.title}</h3>
                      <p>Reserve your place and make it part of your week.</p>
                      <div className="card-bottom"><span>${Number(event.price || 0).toFixed(0)}</span><button>Open ↗</button></div>
                    </article>
                ))}
              </div>
          )}

          {!loading && featured.length === 0 && <div className="empty-state">No events are on sale right now. Check back soon.</div>}
        </section>

        <section className="stats-strip">
          <div><span>01</span><strong>{totalEvents}</strong><p>listed events</p></div>
          <div><span>02</span><strong>${totalValue.toFixed(0)}</strong><p>combined ticket value</p></div>
          <div><span>03</span><strong>AI</strong><p>feedback intelligence</p></div>
          <div><span>04</span><strong>{userId ? 'ON' : '24/7'}</strong><p>{userId ? 'your account is ready' : 'discover anytime'}</p></div>
        </section>

        <section className="split-story">
          <div className="story-dark"><span className="eyebrow">MORE THAN A CATALOG</span><h2>One place for the whole experience.</h2><p>EventHub connects discovery, booking, feedback and analytics into one coherent product instead of four disconnected screens.</p><button className="button button-light" onClick={onExplore}>Start exploring →</button></div>
          <div className="story-paper">
            <div className="process-step"><b>01</b><div><strong>Discover</strong><span>Find something worth leaving home for.</span></div></div>
            <div className="process-step"><b>02</b><div><strong>Reserve</strong><span>One clear action. One confirmed booking.</span></div></div>
            <div className="process-step"><b>03</b><div><strong>Reflect</strong><span>Share your experience and let AI read the mood.</span></div></div>
            <div className="process-step"><b>04</b><div><strong>Understand</strong><span>Turn activity into useful event intelligence.</span></div></div>
          </div>
        </section>
      </div>
  );
}

function ExplorePage({ catalog, loading, error, onRetry, onSelect }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');

  const filtered = useMemo(() => {
    const result = catalog.filter((event) => event.title?.toLowerCase().includes(query.toLowerCase()));
    if (sort === 'price-low') result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-high') result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return result;
  }, [catalog, query, sort]);

  return (
      <section className="page-section explore-page">
        <div className="page-hero">
          <div><span className="eyebrow">THE CATALOG</span><h1>Find your next <em>yes.</em></h1><p>Browse the live EventHub catalog. Search, compare, open the details and reserve without leaving the flow.</p></div>
          <div className="page-index">EXPLORE / 01</div>
        </div>

        <div className="catalog-toolbar">
          <div className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by event name..." /></div>
          <div className="sort-group">
            {['featured', 'price-low', 'price-high', 'name'].map((value) => (
                <button key={value} className={sort === value ? 'sort-chip active' : 'sort-chip'} onClick={() => setSort(value)}>
                  {value === 'featured' ? 'Featured' : value === 'price-low' ? 'Price ↑' : value === 'price-high' ? 'Price ↓' : 'A–Z'}
                </button>
            ))}
          </div>
        </div>

        {error && <div className="error-banner"><strong>Catalog unavailable.</strong><span>{error}</span><button onClick={onRetry}>Retry</button></div>}

        {loading ? <SkeletonCards count={6} /> : (
            <div className="catalog-list">
              {filtered.map((event, index) => (
                  <article className="event-row" key={event.id} onClick={() => onSelect(event)}>
                    <div className="row-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="row-art"><span>{['✦', '◈', '○', '△'][index % 4]}</span></div>
                    <div className="row-content"><span className="card-tag">EVENT · {String(event.id).padStart(2, '0')}</span><h2>{event.title}</h2><p>Live listing · Admit one · Instant reservation</p></div>
                    <div className="row-price"><small>FROM</small><strong>${Number(event.price || 0).toFixed(0)}</strong></div>
                    <button className="row-open" aria-label={`Open ${event.title}`}>↗</button>
                  </article>
              ))}
            </div>
        )}

        {!loading && filtered.length === 0 && !error && <div className="empty-state large">No events match “{query}”. Try another search.</div>}
      </section>
  );
}

function AIPage({ aiText, setAiText, aiResult, aiLoading, onAnalyze }) {
  return (
      <section className="page-section ai-page">
        <div className="page-hero">
          <div><span className="eyebrow">INTELLIGENCE LAYER · 8084</span><h1>Give feedback a <em>voice.</em></h1><p>Use the EventHub AI service to turn a sentence of feedback into a readable sentiment signal.</p></div>
          <div className="page-index">AI STUDIO / 02</div>
        </div>

        <div className="ai-layout">
          <div className="ai-editor">
            <div className="editor-top"><span>REVIEW INPUT</span><span>LIVE ANALYSIS</span></div>
            <form onSubmit={onAnalyze}>
              <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="“The event was beautifully organized, the atmosphere was amazing, and I would absolutely come back.”" />
              <div className="editor-bottom"><span>{aiText.length} characters</span><button className="button button-primary" disabled={aiLoading}>{aiLoading ? 'Reading...' : 'Analyze feedback →'}</button></div>
            </form>
          </div>
          <div className="ai-result">
            <span className="eyebrow">RESULT</span>
            {!aiResult ? <div className="result-placeholder"><span>✦</span><h3>Your signal appears here.</h3><p>Write a review on the left and let the AI service classify its mood.</p></div> : aiResult.error ? <div className="result-error">{aiResult.error}</div> : (
                <div className="result-content">
                  <div className={`sentiment-orb ${String(aiResult.sentiment).toLowerCase()}`}><span>{String(aiResult.sentiment).slice(0, 1).toUpperCase()}</span></div>
                  <small>SENTIMENT</small><h2>{aiResult.sentiment}</h2>
                  <div className="result-summary"><span>SUMMARY</span><p>{aiResult.summary}</p></div>
                </div>
            )}
          </div>
        </div>

        <div className="ai-footnote"><span>AI SERVICE</span><strong>FastAPI sentiment analysis</strong><span>→</span><strong>Connected to EventHub feedback flow</strong></div>
      </section>
  );
}

function ReviewPage({ token, lastBooking, reviewText, setReviewText, reviewMessage, reviewLoading, onSubmit, onLogin, onExplore }) {
  return (
      <section className="page-section review-page">
        <div className="page-hero">
          <div><span className="eyebrow">THE COMMUNITY</span><h1>Say what you <em>felt.</em></h1><p>Your review is more than a rating. It becomes a signal for the next person and an input for EventHub intelligence.</p></div>
          <div className="page-index">REVIEWS / 03</div>
        </div>

        <div className="review-layout">
          <div className="review-form-card">
            <span className="card-tag">YOUR EXPERIENCE</span>
            {lastBooking ? (
                <div className="booking-ticket">
                  <div><small>CONFIRMED BOOKING</small><strong>{lastBooking.eventTitle || `Event #${lastBooking.eventId}`}</strong></div>
                  <span>#{lastBooking.id}</span>
                </div>
            ) : (
                <div className="review-empty-booking"><span>◇</span><div><strong>No booking selected</strong><p>Reserve an event first and your review will automatically connect to it.</p></div></div>
            )}

            <form onSubmit={onSubmit}>
              <label>YOUR REVIEW</label>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What made the experience memorable?" />
              <div className="review-form-bottom"><span>Be honest. Be useful.</span><button className="button button-primary" disabled={reviewLoading || !token}>{reviewLoading ? 'Publishing...' : 'Publish review →'}</button></div>
            </form>

            {reviewMessage && <div className="inline-message">{reviewMessage}</div>}
            {!token && <button className="soft-link" onClick={onLogin}>Log in to publish your review →</button>}
          </div>

          <div className="review-aside">
            <div className="quote-mark">“</div>
            <blockquote>Good event products don't stop at the ticket. They remember what happened after the door opened.</blockquote>
            <div className="review-rule" />
            <span>EVENTHUB PRINCIPLE</span>
            <button className="text-link" onClick={onExplore}>Find an event to review →</button>
          </div>
        </div>
      </section>
  );
}

function AccountPage({ userId, email, lastBooking, onLogin, onLogout, onExplore }) {
  return (
      <section className="page-section account-page">
        <div className="page-hero">
          <div><span className="eyebrow">YOUR SPACE</span><h1>Your EventHub <em>pass.</em></h1><p>Keep your session, latest reservation and next action in one clean place.</p></div>
          <div className="page-index">ACCOUNT / 04</div>
        </div>

        {!userId ? (
            <div className="account-guest"><span>◎</span><h2>You're browsing as a guest.</h2><p>Sign in to reserve tickets and publish reviews.</p><button className="button button-primary" onClick={onLogin}>Sign in →</button></div>
        ) : (
            <div className="account-grid">
              <div className="identity-card"><div className="big-avatar">{email?.charAt(0).toUpperCase() || 'U'}</div><span className="eyebrow">MEMBER</span><h2>{email || 'EventHub member'}</h2><p>Account ID · {userId}</p><button className="button button-dark" onClick={onLogout}>Sign out</button></div>
              <div className="ticket-panel"><span className="eyebrow">LATEST TICKET</span>{lastBooking ? <div className="big-ticket"><div><small>BOOKING #{lastBooking.id}</small><h2>{lastBooking.eventTitle || `Event #${lastBooking.eventId}`}</h2><p>Confirmed reservation · ${Number(lastBooking.price || 0).toFixed(0)}</p></div><span>✓</span></div> : <div className="no-ticket"><strong>Your next event is waiting.</strong><button className="text-link" onClick={onExplore}>Explore the catalog →</button></div>}</div>
            </div>
        )}
      </section>
  );
}

function EventModal({ event, loading, onClose, onBook }) {
  return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="event-modal">
          <button className="modal-close" onClick={onClose}>×</button>
          <div className="modal-art"><span>✦</span><small>EVENT / {String(event.id).padStart(2, '0')}</small></div>
          <div className="modal-content">
            <span className="eyebrow">LIVE LISTING</span>
            <h2>{event.title}</h2>
            <p>One ticket. One experience. A place worth being in when the moment happens.</p>
            <div className="modal-meta"><div><small>PRICE</small><strong>${Number(event.price || 0).toFixed(0)}</strong></div><div><small>ENTRY</small><strong>Admit one</strong></div><div><small>BOOKING</small><strong>Instant</strong></div></div>
            <button className="button button-primary modal-book" onClick={() => onBook(event)} disabled={loading}>{loading ? 'Confirming your seat...' : 'Reserve this event →'}</button>
            <span className="modal-note">Secure through your EventHub booking service.</span>
          </div>
        </div>
      </div>
  );
}

function AuthModal({ mode, setMode, email, setEmail, password, setPassword, loading, message, onSubmit, onClose }) {
  return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="auth-modal">
          <button className="modal-close" onClick={onClose}>×</button>
          <div className="auth-art"><span>EH</span><small>EVENTHUB</small></div>
          <div className="auth-content">
            <span className="eyebrow">MEMBER ACCESS</span>
            <h2>{mode === 'login' ? 'Welcome back.' : 'Join EventHub.'}</h2>
            <p>{mode === 'login' ? 'Your next experience is one sign-in away.' : 'Create your account and start reserving.'}</p>
            <form onSubmit={onSubmit}>
              <label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <button className="button button-primary auth-submit" disabled={loading}>{loading ? 'Working...' : mode === 'login' ? 'Sign in →' : 'Create account →'}</button>
            </form>
            {message && <div className="inline-message">{message}</div>}
            <button className="switch-auth" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Need an account? Create one' : 'Already a member? Sign in'}</button>
          </div>
        </div>
      </div>
  );
}

function SkeletonCards({ count = 3 }) {
  return <div className="featured-grid skeleton-grid">{Array.from({ length: count }).map((_, i) => <div className="skeleton-card" key={i}><span /><span /><span /><span /></div>)}</div>;
}
