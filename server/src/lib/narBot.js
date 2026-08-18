export const NAR_BOT_ID = '00000000-0000-4000-8000-0000000000aa';
export const NAR_BOT_NAME = 'NAR';

const replies = [
  {
    test: (text) => /help|how (do|can)|what can you/i.test(text),
    reply: (_text, name) => (
      `Here is the short tour, ${name}: create or join a room, type to chat, and tap the camera icon when you want video. Mention @nar and I will answer in this room.`
    ),
  },
  {
    test: (text) => /camera|video|webcam|not opening|doesn't load|doesnt load|black screen/i.test(text),
    reply: () => (
      'Allow camera and microphone in the browser address bar, then tap Retry camera. Use https or localhost — a raw IP address blocks the camera. Close other apps that might already be using it.'
    ),
  },
  {
    test: (text) => /mic|mute|audio|sound|speaker/i.test(text),
    reply: () => (
      'Tap the mic button in the call lobby to mute or unmute. Use Test speaker to confirm output. If nobody can hear you, pick another microphone in the device list.'
    ),
  },
  {
    test: (text) => /invite|share|link|password|private/i.test(text),
    reply: () => (
      'Open a room and tap share to copy the invite link. Private rooms need the password you set when creating them.'
    ),
  },
  {
    test: (text) => /call|meeting|join meeting|webrtc/i.test(text),
    reply: () => (
      'From a room, tap the camera or phone icon. Check your preview, then Join Meeting. Other people in the room can join the same live call.'
    ),
  },
  {
    test: (text) => /theme|dark|light|mode/i.test(text),
    reply: () => (
      'Use the sun / moon / monitor control to cycle system, light, and dark. NAR stays black and white either way.'
    ),
  },
  {
    test: (text) => /who are you|what are you|your name/i.test(text),
    reply: () => (
      'I am NAR, the NotAllowedRoom assistant. I keep rooms private, calls simple, and answers short.'
    ),
  },
  {
    test: (text) => /thank|thanks|awesome|great|nice/i.test(text),
    reply: () => 'Anytime. Mention @nar if you need another hand.',
  },
  {
    test: (text) => /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/i.test(text),
    reply: (_text, name) => `Hello ${name}. Ask me about rooms, camera, calls, or invites.`,
  },
  {
    test: (text) => /joke|funny/i.test(text),
    reply: () => 'Why did the webcam apply for a job? It wanted to focus on its career.',
  },
  {
    test: (text) => /time|date|day/i.test(text),
    reply: () => {
      const now = new Date();
      return `It is ${now.toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.`;
    },
  },
];

const fallbacks = [
  (name) => `I am with you, ${name}. Try asking about camera, rooms, invites, or how to start a call.`,
  () => 'I can help with camera access, joining rooms, and live calls. Ask that in plain language.',
  () => 'Not sure I followed that. Mention camera, chat, or calls and I will get more specific.',
];

export const isNarMention = (message = '') => (
  /(^|\s)(@nar|@bot|\/nar|nar)\b/i.test(String(message))
);

export const shouldNarReplyInRoom = (message = '') => isNarMention(message);

export function getNarReply(message = '', userName = 'there') {
  const text = String(message || '').replace(/@nar|@bot|\/nar/gi, '').trim() || 'hello';
  const name = String(userName || 'there').split(' ')[0] || 'there';
  const match = replies.find((item) => item.test(text));
  if (match) return match.reply(text, name);
  return fallbacks[Math.abs(text.length) % fallbacks.length](name);
}
