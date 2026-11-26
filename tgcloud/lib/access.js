// Access control: owner, allow-listed users, or everyone when public mode is on.
// Managed from the bot: access requests with buttons, /users, /allow, /deny.
import { api, db } from 'sdk';
import { eq, inArray } from 'sdk/db';
import { users } from '../schema.js';
import { getOwnerId, getSetting, setSetting } from './settings.js';

export const displayName = (u) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || String(u.id);

export async function isPublic() {
  return (await getSetting('public')) === '1';
}

export async function setPublic(on) {
  await setSetting('public', on ? '1' : '0');
}

export async function getUser(userId) {
  return db.select().from(users).where(eq(users.userId, userId)).get();
}

export async function setStatus(userId, status, from) {
  const values = { userId, status, name: from ? displayName(from) : String(userId), username: from?.username ?? null };
  await db.insert(users).values(values)
    .onConflictDoUpdate({
      target: users.userId,
      set: from ? { status, name: values.name, username: values.username } : { status },
    })
    .run();
}

export async function removeUser(userId) {
  await db.delete(users).where(eq(users.userId, userId)).run();
}

// 'owner' | 'allowed' | 'public' | null
export async function accessOf(userId) {
  if (userId === (await getOwnerId())) return 'owner';
  if ((await getUser(userId))?.status === 'allowed') return 'allowed';
  if (await isPublic()) return 'public';
  return null;
}

// Called when a stranger writes to the bot. Notifies the owner once per user.
export async function requestAccess(from) {
  const existing = await getUser(from.id);
  if (existing?.status === 'denied') return 'denied';
  if (existing?.status === 'pending') return 'pending';
  await setStatus(from.id, 'pending', from);
  const owner = await getOwnerId();
  if (owner) {
    await api.sendMessage({
      chat_id: owner,
      text: `🔔 Ruxsat so‘rovi:\n${displayName(from)}${from.username ? ` (@${from.username})` : ''}\nID: ${from.id}`,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Ruxsat berish', callback_data: `acc:allow:${from.id}` },
          { text: '❌ Rad etish', callback_data: `acc:deny:${from.id}` },
        ]],
      },
    });
  }
  return 'requested';
}

// /users screen: public toggle + one row per user with actions.
export async function buildUsersMenu() {
  const pub = await isPublic();
  const rows = await db.select().from(users)
    .where(inArray(users.status, ['allowed', 'pending']))
    .all();
  const label = (u) => `${u.name}${u.username ? ` @${u.username}` : ''}`;

  const keyboard = [[{
    text: pub ? '🌍 Hammaga ochiq — yopish' : '🔒 Faqat ruxsatlilar — hammaga ochish',
    callback_data: 'acc:public',
  }]];
  for (const u of rows) {
    keyboard.push(u.status === 'pending'
      ? [
        { text: `⏳ ${label(u)}`, callback_data: 'noop' },
        { text: '✅', callback_data: `acc:allow:${u.userId}` },
        { text: '❌', callback_data: `acc:deny:${u.userId}` },
      ]
      : [
        { text: `👤 ${label(u)}`, callback_data: 'noop' },
        { text: '🗑 O‘chirish', callback_data: `acc:del:${u.userId}` },
      ]);
  }

  const allowed = rows.filter((u) => u.status === 'allowed').length;
  const pending = rows.length - allowed;
  return {
    text: [
      `Rejim: ${pub ? '🌍 hammaga ochiq (har kim sizning kalitingizdan foydalanadi)' : '🔒 faqat ruxsat berilganlar'}`,
      `Ruxsat berilgan: ${allowed}${pending ? ` · Kutayotgan: ${pending}` : ''}`,
      '',
      'Qo‘lda: /allow <id> · /deny <id>',
      'Yangi odam botga /start yozsa, sizga so‘rov keladi.',
    ].join('\n'),
    reply_markup: { inline_keyboard: keyboard },
  };
}
