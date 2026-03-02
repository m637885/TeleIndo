import { create } from 'zustand';
import { useTdwebStore } from './useTdwebStore';
import Pusher from 'pusher-js';

interface AppState {
  sessionString: string | null;
  userId: string | null;
  authStep: 'init' | 'phone' | 'code' | 'password' | 'authenticated';
  dialogs: any[];
  contacts: any[];
  messages: Record<string, any[]>;
  activeDialogId: string | null;
  error: string | null;
  
  // Pusher State
  pusher: Pusher | null;
  initPusher: (userId: string) => void;

  // Video Call State
  incomingCall: { isReceivingCall: boolean; from: string; name: string; signal: any } | null;
  callAccepted: boolean;
  callEnded: boolean;
  
  initSocket: (isTestServer?: boolean) => void;
  setAuthStep: (step: AppState['authStep']) => void;
  setSessionString: (session: string) => void;
  setError: (error: string | null) => void;
  setActiveDialog: (id: string) => void;
  
  submitPhone: (phone: string) => void;
  submitCode: (code: string) => void;
  submitPassword: (password: string) => void;
  sendMessage: (message: string) => void;
  getMessages: (entityId: string) => void;
  getContacts: () => void;
  createGroup: (title: string, userIds: string[]) => void;
  
  // Video Call Actions
  setIncomingCall: (call: AppState['incomingCall']) => void;
  setCallAccepted: (accepted: boolean) => void;
  setCallEnded: (ended: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessionString: typeof window !== 'undefined' ? localStorage.getItem('telegram_session') : null,
  userId: null,
  authStep: 'init',
  dialogs: [],
  contacts: [],
  messages: {},
  activeDialogId: null,
  error: null,
  
  pusher: null,
  
  incomingCall: null,
  callAccepted: false,
  callEnded: false,

  initPusher: (userId: string) => {
    if (get().pusher || !process.env.NEXT_PUBLIC_PUSHER_APP_KEY) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(`user-${userId}`);

    channel.bind('incomingCall', (data: { from: string; name: string; signal: any }) => {
      set({ incomingCall: { isReceivingCall: true, from: data.from, name: data.name, signal: data.signal } });
    });

    channel.bind('callAccepted', (data: { signal: any }) => {
      set({ callAccepted: true });
      // The component will handle the signal via a custom event or store subscription
      window.dispatchEvent(new CustomEvent('pusherCallAccepted', { detail: data.signal }));
    });

    channel.bind('callEnded', () => {
      set({ callEnded: true, incomingCall: null, callAccepted: false });
    });

    set({ pusher, userId });
  },

  initSocket: (isTestServer?: boolean) => {
    const tdwebStore = useTdwebStore.getState();
    if (tdwebStore.client) return; // Already initialized
    
    tdwebStore.initClient(isTestServer);
    
    // Sync authStep, error, and userId from tdwebStore to appStore
    useTdwebStore.subscribe((state) => {
      set({ authStep: state.authStep, error: state.error, userId: state.userId });
      
      // Initialize Pusher once authenticated and we have a user ID
      if (state.authStep === 'authenticated' && state.userId && !get().pusher) {
        get().initPusher(state.userId);
      }
    });
  },

  setAuthStep: (step) => set({ authStep: step }),
  setSessionString: (session) => set({ sessionString: session }),
  setError: (error) => set({ error }),
  
  setActiveDialog: (id) => {
    set({ activeDialogId: id });
    // TODO: implement with tdweb
  },

  submitPhone: (phone) => useTdwebStore.getState().submitPhone(phone),
  submitCode: (code) => useTdwebStore.getState().submitCode(code),
  submitPassword: (password) => useTdwebStore.getState().submitPassword(password),
  
  sendMessage: (message) => {
    // TODO: implement with tdweb
  },

  getMessages: (entityId) => {
    // TODO: implement with tdweb
  },

  getContacts: () => {
    // TODO: implement with tdweb
  },

  createGroup: (title, userIds) => {
    // TODO: implement with tdweb
  },

  setIncomingCall: (call) => set({ incomingCall: call }),
  setCallAccepted: (accepted) => set({ callAccepted: accepted }),
  setCallEnded: (ended) => set({ callEnded: ended }),
}));
