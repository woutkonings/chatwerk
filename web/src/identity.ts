// The display name and a random client id, kept in this browser. There are no
// accounts. The client id lets the server count one reaction per listener.
const NAME_KEY = 'music-chat:name';
const CLIENT_KEY = 'music-chat:client';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the value lives only for this page.
  }
}

// crypto.randomUUID needs a secure context, and a LAN demo runs on plain http.
function randomId(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => alphabet[byte % alphabet.length]).join('');
}

let clientId = read(CLIENT_KEY);

export function getClientId(): string {
  if (!clientId) {
    clientId = randomId(20);
    write(CLIENT_KEY, clientId);
  }
  return clientId;
}

export const getName = () => read(NAME_KEY);
export const saveName = (name: string) => write(NAME_KEY, name);

const WORDS_A = ['acid', 'deep', 'dark', 'dub', 'warm', 'raw', 'hazy', 'neon', 'late', 'lost', 'low', 'wet'];
const WORDS_B = ['basement', 'warehouse', 'tunnel', 'bunker', 'echo', 'pulse', 'signal', 'static', 'orbit', 'groove'];

export function newRoomId(): string {
  const pick = (words: string[]) => words[crypto.getRandomValues(new Uint8Array(1))[0] % words.length];
  return `${pick(WORDS_A)}-${pick(WORDS_B)}-${randomId(4)}`;
}
