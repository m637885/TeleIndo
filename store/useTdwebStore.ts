import { create } from 'zustand';

interface TdwebState {
  client: any;
  userId: string | null;
  authStep: 'init' | 'phone' | 'code' | 'password' | 'authenticated';
  error: string | null;
  initClient: (isTestServer?: boolean) => void;
  submitPhone: (phone: string) => void;
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
  setAuthStep: (step: TdwebState['authStep']) => void;
  setError: (error: string | null) => void;
}

export const useTdwebStore = create<TdwebState>((set, get) => ({
  client: null,
  userId: null,
  authStep: 'init',
  error: null,

  initClient: async (isTestServer = false) => {
    if (get().client) return;

    try {
      // We need to dynamically import tdweb because it's a browser-only library
      const TdClient = (await import('tdweb')).default;

      const client = new TdClient({
        logVerbosityLevel: 1,
        jsLogVerbosityLevel: 3,
        mode: 'wasm',
        useTestDC: isTestServer,
        onUpdate: (update: any) => {
          console.log('tdweb update:', update);
          
          if (update['@type'] === 'updateAuthorizationState') {
            const state = update.authorization_state;
            
            if (state['@type'] === 'authorizationStateWaitTdlibParameters') {
              client.send({
                '@type': 'setTdlibParameters',
                parameters: {
                  use_test_dc: isTestServer,
                  database_directory: '/tdlib',
                  files_directory: '/tdlib',
                  use_file_database: true,
                  use_chat_info_database: true,
                  use_message_database: true,
                  use_secret_chats: false,
                  api_id: Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID),
                  api_hash: process.env.NEXT_PUBLIC_TELEGRAM_API_HASH,
                  system_language_code: 'en',
                  device_model: 'Browser',
                  system_version: navigator.userAgent,
                  application_version: '1.0.0',
                  enable_storage_optimizer: true,
                }
              });
            } else if (state['@type'] === 'authorizationStateWaitEncryptionKey') {
              client.send({
                '@type': 'checkDatabaseEncryptionKey',
                encryption_key: ''
              });
            } else if (state['@type'] === 'authorizationStateWaitPhoneNumber') {
              set({ authStep: 'phone', error: null });
            } else if (state['@type'] === 'authorizationStateWaitCode') {
              set({ authStep: 'code', error: null });
            } else if (state['@type'] === 'authorizationStateWaitPassword') {
              set({ authStep: 'password', error: null });
            } else if (state['@type'] === 'authorizationStateReady') {
              set({ authStep: 'authenticated', error: null });
              
              // Get the current user ID
              client.send({ '@type': 'getMe' }).then((me: any) => {
                set({ userId: String(me.id) });
              }).catch(console.error);
            }
          } else if (update['@type'] === 'updateConnectionState') {
            console.log('Connection state:', update.state['@type']);
          }
        }
      });

      set({ client });
    } catch (err) {
      console.error('Failed to init tdweb:', err);
      set({ error: 'Failed to initialize Telegram client' });
    }
  },

  submitPhone: async (phone: string) => {
    const { client } = get();
    if (!client) return;

    try {
      await client.send({
        '@type': 'setAuthenticationPhoneNumber',
        phone_number: phone
      });
    } catch (err: any) {
      console.error('submitPhone error:', err);
      set({ error: err.message || 'Failed to submit phone number' });
    }
  },

  submitCode: async (code: string) => {
    const { client } = get();
    if (!client) return;

    try {
      await client.send({
        '@type': 'checkAuthenticationCode',
        code: code
      });
    } catch (err: any) {
      console.error('submitCode error:', err);
      set({ error: err.message || 'Invalid code' });
    }
  },

  submitPassword: async (password: string) => {
    const { client } = get();
    if (!client) return;

    try {
      await client.send({
        '@type': 'checkAuthenticationPassword',
        password: password
      });
    } catch (err: any) {
      console.error('submitPassword error:', err);
      set({ error: err.message || 'Invalid password' });
    }
  },

  setAuthStep: (step) => set({ authStep: step }),
  setError: (error) => set({ error }),
}));
