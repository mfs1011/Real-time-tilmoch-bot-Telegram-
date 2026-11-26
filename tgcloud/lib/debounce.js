// Debounce for inline queries. The runtime has no setTimeout, so "waiting" is
// done by re-reading the newest query id from the DB until the window passes.
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { inlineState } from '../schema.js';

export const DEBOUNCE_MS = 500;

// Returns true if this query is still the newest after `ms`,
// false as soon as a newer query from the same user shows up.
export async function settle(userId, queryId, ms = DEBOUNCE_MS) {
  await db.insert(inlineState).values({ userId, queryId })
    .onConflictDoUpdate({ target: inlineState.userId, set: { queryId } })
    .run();

  const until = Date.now() + ms;
  while (Date.now() < until) {
    const row = await db.select().from(inlineState).where(eq(inlineState.userId, userId)).get();
    if (row?.queryId !== queryId) return false;
  }
  return true;
}
