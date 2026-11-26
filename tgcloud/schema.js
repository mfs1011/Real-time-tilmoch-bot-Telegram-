import { table, integer, text, sql } from 'sdk/db';

// Key/value bot settings: owner_id, llm_provider, llm_key, gemini_model, default_lang.
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

// Translation cache — inline queries repeat a lot while typing.
export const cache = table('cache', {
  key:     text('key').primaryKey(),
  value:   text('value').notNull(),
  created: integer('created_at').default(sql`(unixepoch())`),
});

// Who may use the bot besides the owner. status: 'pending' | 'allowed' | 'denied'.
export const users = table('users', {
  userId:   integer('user_id').primaryKey(),
  name:     text('name').notNull(),
  username: text('username'),
  status:   text('status').notNull(),
  updated:  integer('updated_at').default(sql`(unixepoch())`),
});

// Texts behind "🔊 Ovozli" buttons (callback_data is limited to 64 bytes).
export const snippets = table('snippets', {
  id:      integer('id').primaryKey({ autoIncrement: true }),
  text:    text('text').notNull(),
  created: integer('created_at').default(sql`(unixepoch())`),
});

// Inline debounce: the newest inline query id per user. An older query that
// sees a newer id here gives up before calling the LLM.
export const inlineState = table('inline_state', {
  userId:  integer('user_id').primaryKey(),
  queryId: text('query_id').notNull(),
});
