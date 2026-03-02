import { create } from 'zustand';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { computeCheck } from 'telegram/Password';
import { Buffer } from 'buffer';

interface TdwebState {
  client: TelegramClient | null;
  userId: string | null;
  authStep: 'init' | 'phone' | 'code' | 'password' | 'authenticated';
  error: string | null;
  phoneCodeHash: string | null;
  phoneNumber: string | null;
  initClient: (isTestServer?: boolean) => void;
  submitPhone: (phone: string) => void;
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
  setAuthStep: (step: TdwebState['authStep']) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useTdwebStore = create<TdwebState>((set, get) => ({
  client: null,
  userId: null,
  authStep: 'init',
  error: null,
  phoneCodeHash: null,
  phoneNumber: null,

  initClient: async (isTestServer = false) => {
    if (typeof window === 'undefined') return;
    if (get().client) return;

    try {
      const apiId = Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID || 2040);
      const apiHash = process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || 'b18441a1ff607e10a989891a5462e627';
      
      const savedSession = localStorage.getItem('telegram_session') || '';
      const stringSession = new StringSession(savedSession);

      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        useWSS: true,
        testServers: isTestServer,
      });

      set({ client });

      await client.connect();

      try {
        if (await client.checkAuthorization()) {
          const me = await client.getMe();
          set({ authStep: 'authenticated', userId: String(me.id), error: null });
        } else {
          set({ authStep: 'phone', error: null });
        }
      } catch (authErr: any) {
        console.error('Auth check error:', authErr);
        if (authErr.message && authErr.message.includes('AUTH_KEY_UNREGISTERED')) {
          localStorage.removeItem('telegram_session');
          set({ authStep: 'phone', error: null });
        } else {
          set({ authStep: 'phone', error: null });
        }
      }
    } catch (err) {
      console.error('Failed to init GramJS:', err);
      set({ error: 'Failed to initialize Telegram client. Please refresh.' });
    }
  },

  submitPhone: async (phone: string) => {
    const { client } = get();
    if (!client) return;

    try {
      const result = await client.sendCode(
        {
          apiId: Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID || 2040),
          apiHash: process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || 'b18441a1ff607e10a989891a5462e627',
        },
        phone
      );
      set({ authStep: 'code', phoneCodeHash: result.phoneCodeHash, phoneNumber: phone, error: null });
    } catch (err: any) {
      console.error('submitPhone error:', err);
      set({ error: err.message || 'Failed to submit phone number' });
    }
  },

  submitCode: async (code: string) => {
    const { client, phoneNumber, phoneCodeHash } = get();
    if (!client || !phoneNumber || !phoneCodeHash) return;

    try {
      await client.invoke(new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      }));
      
      const me = await client.getMe();
      localStorage.setItem('telegram_session', (client.session as StringSession).save());
      set({ authStep: 'authenticated', userId: String(me.id), error: null });
    } catch (err: any) {
      console.error('submitCode error:', err);
      if (err.message && err.message.includes('SESSION_PASSWORD_NEEDED')) {
        set({ authStep: 'password', error: null });
      } else {
        set({ error: err.message || 'Invalid code' });
      }
    }
  },

  submitPassword: async (password: string) => {
    const { client } = get();
    if (!client) return;

    try {
      const passwordParams = await client.invoke(new Api.account.GetPassword());
      const passwordSrp = await computeCheck(passwordParams, password);
      
      // Fix Buffer instanceof issue in GramJS
      passwordSrp.A = Buffer.from(passwordSrp.A);
      passwordSrp.M1 = Buffer.from(passwordSrp.M1);

      await client.invoke(new Api.auth.CheckPassword({
        password: passwordSrp
      }));
      
      const me = await client.getMe();
      localStorage.setItem('telegram_session', (client.session as StringSession).save());
      set({ authStep: 'authenticated', userId: String(me.id), error: null });
    } catch (err: any) {
      console.error('submitPassword error:', err);
      set({ error: err.message || 'Invalid password' });
    }
  },

  setAuthStep: (step) => set({ authStep: step }),
  setError: (error) => set({ error }),
  logout: () => {
    localStorage.removeItem('telegram_session');
    set({ authStep: 'phone', userId: null, error: null, phoneCodeHash: null, phoneNumber: null });
    window.location.reload();
  }
}));
