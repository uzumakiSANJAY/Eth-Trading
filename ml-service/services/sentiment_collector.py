"""
Sentiment Data Collector
Collects Reddit posts + news headlines daily, auto-labels them,
and stores to a local SQLite DB for model training.
No external API keys needed beyond what is already configured.
"""
import os
import json
import time
import sqlite3
import logging
import urllib.request
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), '../models/sentiment_training.db')

BULLISH_KEYWORDS = [
    'bullish', 'pump', 'moon', 'buy', 'accumulate', 'breakout', 'surge',
    'rally', 'upside', 'long', 'green', 'ath', 'adoption', 'upgrade',
    'institutional', 'etf', 'positive', 'growth', 'strong', 'outperform'
]
BEARISH_KEYWORDS = [
    'bearish', 'dump', 'crash', 'sell', 'short', 'correction', 'rekt',
    'scam', 'fear', 'capitulation', 'warning', 'down', 'bear', 'panic',
    'collapse', 'exit', 'decline', 'risk', 'concern', 'trouble'
]

SUBREDDITS = ['ethereum', 'ethtrader', 'CryptoCurrency']


class SentimentCollector:

    def __init__(self):
        self._init_db()

    def _init_db(self):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS sentiment_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collected_at TEXT NOT NULL,
                source TEXT NOT NULL,
                text TEXT NOT NULL,
                auto_label INTEGER NOT NULL,   -- -1 bearish, 0 neutral, 1 bullish
                label_confidence REAL NOT NULL,
                post_score INTEGER DEFAULT 0,
                used_for_training INTEGER DEFAULT 0
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_collected_at ON sentiment_data(collected_at)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_source ON sentiment_data(source)')
        conn.commit()
        conn.close()
        logger.info(f"Sentiment DB initialized at {DB_PATH}")

    def auto_label(self, text: str) -> tuple:
        """
        Keyword-based auto labeling.
        Returns (label, confidence) where label is -1/0/1
        """
        lower = text.lower()
        bull = sum(1 for kw in BULLISH_KEYWORDS if kw in lower)
        bear = sum(1 for kw in BEARISH_KEYWORDS if kw in lower)
        total = bull + bear

        if total == 0:
            return 0, 0.5  # neutral, low confidence

        bull_ratio = bull / total
        confidence = min(0.5 + abs(bull_ratio - 0.5), 0.95)

        if bull_ratio > 0.6:
            return 1, confidence
        elif bull_ratio < 0.4:
            return -1, confidence
        else:
            return 0, 0.5

    def fetch_reddit(self, subreddit: str) -> list:
        """Fetch hot posts from subreddit using public JSON API."""
        url = f'https://www.reddit.com/r/{subreddit}/hot.json?limit=25'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ETH-Trading-ML/1.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read())
            posts = data.get('data', {}).get('children', [])
            now = time.time()
            return [
                {'text': p['data']['title'], 'score': p['data'].get('score', 0)}
                for p in posts
                if p['data'].get('created_utc', 0) > now - 86400
                and not p['data'].get('stickied', False)
            ]
        except Exception as e:
            logger.warning(f"Reddit fetch failed ({subreddit}): {e}")
            return []

    def collect_and_store(self):
        """Main collection method — call this daily via scheduler."""
        collected_at = datetime.utcnow().isoformat()
        conn = sqlite3.connect(DB_PATH)
        inserted = 0

        for sub in SUBREDDITS:
            posts = self.fetch_reddit(sub)
            for post in posts:
                text = post['text'].strip()
                if len(text) < 10:
                    continue
                label, confidence = self.auto_label(text)
                # Only store if we have some signal (skip very neutral text)
                if confidence >= 0.55 or label != 0:
                    conn.execute(
                        'INSERT INTO sentiment_data (collected_at, source, text, auto_label, label_confidence, post_score) VALUES (?,?,?,?,?,?)',
                        (collected_at, f'reddit/{sub}', text, label, confidence, post['score'])
                    )
                    inserted += 1
            time.sleep(1)  # Polite delay between subreddit requests

        conn.commit()
        conn.close()
        logger.info(f"Collected {inserted} labeled posts")
        return inserted

    def get_training_data(self, min_confidence: float = 0.6, limit: int = 5000):
        """Return training data for the sentiment model."""
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute(
            '''SELECT text, auto_label FROM sentiment_data
               WHERE label_confidence >= ? ORDER BY collected_at DESC LIMIT ?''',
            (min_confidence, limit)
        ).fetchall()
        conn.close()
        texts = [r[0] for r in rows]
        labels = [r[1] for r in rows]
        logger.info(f"Loaded {len(texts)} training samples (confidence >= {min_confidence})")
        return texts, labels

    def get_stats(self):
        """Return DB stats."""
        conn = sqlite3.connect(DB_PATH)
        total = conn.execute('SELECT COUNT(*) FROM sentiment_data').fetchone()[0]
        bullish = conn.execute('SELECT COUNT(*) FROM sentiment_data WHERE auto_label=1').fetchone()[0]
        bearish = conn.execute('SELECT COUNT(*) FROM sentiment_data WHERE auto_label=-1').fetchone()[0]
        neutral = conn.execute('SELECT COUNT(*) FROM sentiment_data WHERE auto_label=0').fetchone()[0]
        oldest = conn.execute('SELECT MIN(collected_at) FROM sentiment_data').fetchone()[0]
        conn.close()
        return {
            'total': total, 'bullish': bullish, 'bearish': bearish, 'neutral': neutral,
            'oldest_sample': oldest
        }
