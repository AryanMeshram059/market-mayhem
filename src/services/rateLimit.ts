import { RateLimitError } from '@/lib/errors';
import {
  RATE_LIMIT_ORDERS_PER_MINUTE,
  RATE_LIMIT_P2P_PER_MINUTE,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
} from '@/constants/game';
import type { TeamId } from '@/types';

type RateLimitType = 'general' | 'order' | 'p2p';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number;
}

const buckets = new Map<string, TokenBucket>();

function getBucketKey(teamId: TeamId, type: RateLimitType): string {
  return `${teamId}:${type}`;
}

function getBucketConfig(type: RateLimitType): { maxTokens: number; refillRate: number } {
  switch (type) {
    case 'order':
      return { maxTokens: RATE_LIMIT_ORDERS_PER_MINUTE, refillRate: RATE_LIMIT_ORDERS_PER_MINUTE / 60 };
    case 'p2p':
      return { maxTokens: RATE_LIMIT_P2P_PER_MINUTE, refillRate: RATE_LIMIT_P2P_PER_MINUTE / 60 };
    default:
      return { maxTokens: RATE_LIMIT_REQUESTS_PER_MINUTE, refillRate: RATE_LIMIT_REQUESTS_PER_MINUTE / 60 };
  }
}

export async function checkRateLimit(
  teamId: TeamId,
  cost = 1,
  type: RateLimitType = 'general'
): Promise<void> {
  const key = getBucketKey(teamId, type);
  const config = getBucketConfig(type);
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: now, ...config };
    buckets.set(key, bucket);
  }

  const elapsed = (now - bucket.lastRefill) / 1000;
  const refillAmount = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  if (bucket.tokens < cost) {
    throw new RateLimitError();
  }

  bucket.tokens -= cost;
}
