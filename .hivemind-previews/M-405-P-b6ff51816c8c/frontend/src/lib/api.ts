const API_BASE = import.meta.env.VITE_API_URL as string | undefined;

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn('VITE_API_URL is not set; API calls will fail.');
}

export interface LeaderboardScore {
  id: number;
  name: string;
  score: number;
  difficulty: string;
  createdAt: number;
}

export async function fetchLeaderboard(range: 'all' | 'week' = 'all'): Promise<LeaderboardScore[]> {
  if (!API_BASE) throw new Error('API base URL not configured');
  const res = await fetch(`${API_BASE}/leaderboard?range=${range}`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  const data = await res.json().catch(() => ({}));
  if (!data || !Array.isArray(data.scores)) return [];
  return data.scores as LeaderboardScore[];
}

export async function submitScore(payload: {
  name: string;
  score: number;
  difficulty: 'easy' | 'normal' | 'hard';
}): Promise<LeaderboardScore | null> {
  if (!API_BASE) throw new Error('API base URL not configured');
  const res = await fetch(`${API_BASE}/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = (data && data.error) || 'Failed to submit score';
    throw new Error(msg);
  }
  const data = await res.json().catch(() => null);
  return data as LeaderboardScore;
}
