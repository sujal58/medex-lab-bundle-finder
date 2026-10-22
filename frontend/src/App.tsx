import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'connected' | 'unavailable';

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json() as Promise<{ status: string }>;
      })
      .then((data) => setApiStatus(data.status === 'ok' ? 'connected' : 'unavailable'))
      .catch(() => { if (!controller.signal.aborted) setApiStatus('unavailable'); });
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <p className="eyebrow">MedEx · Full-stack assessment</p>
      <h1>Lab Test Bundle Finder</h1>
      <p>The project structure is ready. Lab catalog endpoints and the bundle planner come next.</p>
      <p className="status">Backend: <strong>{apiStatus}</strong></p>
    </main>
  );
}
