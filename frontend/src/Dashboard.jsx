import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSnapshot = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const data = await api.analyticsSummary();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Analytics unavailable.');
    } finally {
      if (showRefresh) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const events = snapshot?.eventsTable || [];

  const totalBookings = useMemo(
      () =>
          events.reduce(
              (sum, event) =>
                  sum + Number(event.bookingsCount || 0),
              0
          ),
      [events]
  );

  const totalRevenue = useMemo(
      () =>
          events.reduce(
              (sum, event) =>
                  sum + Number(event.revenue || 0),
              0
          ),
      [events]
  );

  const totalReviews = useMemo(
      () =>
          events.reduce(
              (sum, event) =>
                  sum + Number(event.reviewCount || 0),
              0
          ),
      [events]
  );

  const sentiment = snapshot?.sentimentTotals || {};

  const positiveReviews = Number(sentiment.positive || 0);
  const neutralReviews = Number(sentiment.neutral || 0);
  const negativeReviews = Number(sentiment.negative || 0);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = events.filter((event) =>
        String(event.title || '')
            .toLowerCase()
            .includes(query)
    );

    result.sort((a, b) => {
      let first;
      let second;

      if (sortBy === 'title') {
        first = String(a.title || '').toLowerCase();
        second = String(b.title || '').toLowerCase();
      } else if (sortBy === 'bookings') {
        first = Number(a.bookingsCount || 0);
        second = Number(b.bookingsCount || 0);
      } else if (sortBy === 'reviews') {
        first = Number(a.reviewCount || 0);
        second = Number(b.reviewCount || 0);
      } else {
        first = Number(a.revenue || 0);
        second = Number(b.revenue || 0);
      }

      if (first < second) {
        return sortDirection === 'asc' ? -1 : 1;
      }

      if (first > second) {
        return sortDirection === 'asc' ? 1 : -1;
      }

      return 0;
    });

    return result;
  }, [events, search, sortBy, sortDirection]);

  const changeSort = (field) => {
    if (sortBy === field) {
      setSortDirection((current) =>
          current === 'asc' ? 'desc' : 'asc'
      );
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  if (error && !snapshot) {
    return (
        <main className="dashboard-shell">
          <div className="dashboard-state">
            <span>!</span>
            <h2>Dashboard unavailable</h2>
            <p>{error}</p>

            <button
                className="button button-primary"
                onClick={() => fetchSnapshot(true)}
                disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Try again'}
            </button>
          </div>
        </main>
    );
  }

  if (!snapshot) {
    return (
        <main className="dashboard-shell">
          <div className="dashboard-state">
            <div className="loading-circle"></div>
            <h2>Preparing your dashboard</h2>
            <p>
              Collecting the latest EventHub activity...
            </p>
          </div>
        </main>
    );
  }

  return (
      <main className="dashboard-shell">

        {/* INTRO */}
        <section className="dashboard-intro">
          <div>
          <span className="eyebrow">
            CONTROL CENTER
          </span>

            <h1>
              Activity <em>overview</em>
            </h1>

            <p>
              Monitor your events, bookings, revenue and
              audience feedback from one place.
            </p>
          </div>

          <div className="dashboard-updated">
            <small>LAST UPDATED</small>

            <strong>
              {snapshot.generatedAt
                  ? new Date(
                      snapshot.generatedAt
                  ).toLocaleString()
                  : '—'}
            </strong>

            <button
                type="button"
                className="dashboard-refresh"
                onClick={() => fetchSnapshot(true)}
                disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </section>

        {/* ERROR WITHOUT HIDING OLD DATA */}
        {error && (
            <div className="error-banner">
              <strong>Unable to refresh</strong>
              <span>{error}</span>

              <button
                  type="button"
                  onClick={() => fetchSnapshot(true)}
                  disabled={refreshing}
              >
                Retry
              </button>
            </div>
        )}

        {/* KPI CARDS */}
        <section className="dashboard-kpis">

          <div className="dash-kpi">
            <div className="kpi-top">
              <span>01</span>
              <b>↗</b>
            </div>

            <small>Total bookings</small>

            <strong>{totalBookings}</strong>

            <p>Confirmed reservations</p>
          </div>

          <div className="dash-kpi gold">
            <div className="kpi-top">
              <span>02</span>
              <b>$</b>
            </div>

            <small>Revenue</small>

            <strong>
              ${totalRevenue.toFixed(0)}
            </strong>

            <p>Across all listed events</p>
          </div>

          <div className="dash-kpi teal">
            <div className="kpi-top">
              <span>03</span>
              <b>✦</b>
            </div>

            <small>Reviews</small>

            <strong>{totalReviews}</strong>

            <p>Total submitted feedback</p>
          </div>

          <div className="dash-kpi violet">
            <div className="kpi-top">
              <span>04</span>
              <b>★</b>
            </div>

            <small>Positive feedback</small>

            <strong>{positiveReviews}</strong>

            <p>Positive sentiment detected</p>
          </div>

        </section>

        {/* MAIN PANELS */}
        <section className="dashboard-panels">

          {/* EVENT ACTIVITY */}
          <div className="dash-panel">

            <div className="dash-panel-head">
              <div>
              <span className="eyebrow">
                PERFORMANCE
              </span>

                <h2>Event activity</h2>
              </div>

              <span className="panel-count">
              {events.length} events
            </span>
            </div>

            <div className="activity-list">

              {events.length === 0 ? (
                  <div className="dashboard-empty">
                    No event data available.
                  </div>
              ) : (
                  events.map((event, index) => {
                    const bookings = Number(
                        event.bookingsCount || 0
                    );

                    const percentage =
                        totalBookings > 0
                            ? Math.round(
                                (bookings / totalBookings) * 100
                            )
                            : 0;

                    return (
                        <div
                            className="activity-row"
                            key={event.eventId}
                        >
                          <div className="activity-index">
                            {String(index + 1).padStart(2, '0')}
                          </div>

                          <div className="activity-main">
                            <strong>{event.title}</strong>

                            <div className="activity-track">
                        <span
                            style={{
                              width: `${percentage}%`,
                            }}
                        />
                            </div>
                          </div>

                          <div className="activity-number">
                            <strong>{bookings}</strong>
                            <small>bookings</small>
                          </div>
                        </div>
                    );
                  })
              )}

            </div>
          </div>

          {/* SENTIMENT */}
          <div className="dash-panel">

            <div className="dash-panel-head">
              <div>
              <span className="eyebrow">
                AUDIENCE
              </span>

                <h2>Feedback mood</h2>
              </div>
            </div>

            <div className="sentiment-total">
              <strong>{totalReviews}</strong>
              <span>total reviews</span>
            </div>

            <div>

              <div className="mood-row">
                <div>
                <span>
                  <i></i>
                  Positive
                </span>

                  <strong>{positiveReviews}</strong>
                </div>

                <div className="mood-track">
                <span
                    style={{
                      width: `${
                          totalReviews
                              ? (positiveReviews /
                                  totalReviews) *
                              100
                              : 0
                      }%`,
                    }}
                />
                </div>
              </div>

              <div className="mood-row">
                <div>
                <span>
                  <i className="neutral"></i>
                  Neutral
                </span>

                  <strong>{neutralReviews}</strong>
                </div>

                <div className="mood-track">
                <span
                    className="neutral"
                    style={{
                      width: `${
                          totalReviews
                              ? (neutralReviews /
                                  totalReviews) *
                              100
                              : 0
                      }%`,
                    }}
                />
                </div>
              </div>

              <div className="mood-row">
                <div>
                <span>
                  <i className="negative"></i>
                  Negative
                </span>

                  <strong>{negativeReviews}</strong>
                </div>

                <div className="mood-track">
                <span
                    className="negative"
                    style={{
                      width: `${
                          totalReviews
                              ? (negativeReviews /
                                  totalReviews) *
                              100
                              : 0
                      }%`,
                    }}
                />
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* DETAILED TABLE */}
        <section className="dash-panel detailed-panel">

          <div className="detailed-top">

            <div>
            <span className="eyebrow">
              DATA TABLE
            </span>

              <h2>
                Detailed event statistics
              </h2>

              <p>
                Search and compare the performance of
                every event.
              </p>
            </div>

            <div className="table-search">
              <span>⌕</span>

              <input
                  type="text"
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) =>
                      setSearch(e.target.value)
                  }
              />
            </div>

          </div>

          <div className="table-wrapper">

            <table className="dashboard-table">

              <thead>
              <tr>

                <th
                    onClick={() =>
                        changeSort('title')
                    }
                >
                  Event
                  <SortArrow
                      active={sortBy === 'title'}
                      direction={sortDirection}
                  />
                </th>

                <th
                    onClick={() =>
                        changeSort('bookings')
                    }
                >
                  Bookings
                  <SortArrow
                      active={sortBy === 'bookings'}
                      direction={sortDirection}
                  />
                </th>

                <th
                    onClick={() =>
                        changeSort('reviews')
                    }
                >
                  Reviews
                  <SortArrow
                      active={sortBy === 'reviews'}
                      direction={sortDirection}
                  />
                </th>

                <th
                    onClick={() =>
                        changeSort('revenue')
                    }
                >
                  Revenue
                  <SortArrow
                      active={sortBy === 'revenue'}
                      direction={sortDirection}
                  />
                </th>

                <th>Status</th>

              </tr>
              </thead>

              <tbody>

              {filteredEvents.length === 0 ? (
                  <tr>
                    <td
                        colSpan="5"
                        className="table-empty"
                    >
                      No events match your search.
                    </td>
                  </tr>
              ) : (
                  filteredEvents.map((event) => {
                    const bookings = Number(
                        event.bookingsCount || 0
                    );

                    return (
                        <tr key={event.eventId}>

                          <td>
                            <div className="table-event">

                          <span className="event-badge">
                            {String(event.title || '')
                                .charAt(0)
                                .toUpperCase()}
                          </span>

                              <div>
                                <strong>
                                  {event.title}
                                </strong>

                                <small>
                                  ID #{event.eventId}
                                </small>
                              </div>

                            </div>
                          </td>

                          <td>
                            <strong>
                              {bookings}
                            </strong>
                          </td>

                          <td>
                            {Number(
                                event.reviewCount || 0
                            )}
                          </td>

                          <td>
                            <strong>
                              $
                              {Number(
                                  event.revenue || 0
                              ).toFixed(0)}
                            </strong>
                          </td>

                          <td>
                        <span
                            className={
                              bookings > 0
                                  ? 'table-status active'
                                  : 'table-status'
                            }
                        >
                          {bookings > 0
                              ? 'Active'
                              : 'No bookings'}
                        </span>
                          </td>

                        </tr>
                    );
                  })
              )}

              </tbody>

            </table>

          </div>

        </section>

      </main>
  );
}

function SortArrow({
                     active,
                     direction,
                   }) {
  if (!active) {
    return (
        <span className="sort-arrow">
        ↕
      </span>
    );
  }

  return (
      <span className="sort-arrow active">
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}