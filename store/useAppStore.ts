import { create } from 'zustand';
import { useTdwebStore } from './useTdwebStore';
import Pusher from 'pusher-js';
import { Api } from 'telegram';
import { NewMessage } from 'telegram/events';

import bigInt from 'big-integer';

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
  importContact: (phone: string, firstName: string, lastName: string) => void;
  
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
      window.dispatchEvent(new CustomEvent('pusherCallAccepted', { detail: data.signal }));
    });

    channel.bind('callEnded', () => {
      set({ callEnded: true, incomingCall: null, callAccepted: false });
    });

    set({ pusher, userId });
  },

  initSocket: (isTestServer?: boolean) => {
    const tdwebStore = useTdwebStore.getState();
    if (tdwebStore.client) return;
    
    tdwebStore.initClient(isTestServer);
    
    useTdwebStore.subscribe((state) => {
      set({ authStep: state.authStep, error: state.error, userId: state.userId });
      
      if (state.authStep === 'authenticated' && state.userId) {
        if (!get().pusher) {
          get().initPusher(state.userId);
        }
        
        // Load initial data
        const client = state.client;
        if (client && get().dialogs.length === 0) {
          // Fetch dialogs
          client.getDialogs({ limit: 20 }).then((dialogs: any[]) => {
            const formattedDialogs = dialogs.map(d => ({
              id: d.id.toString(),
              title: d.title,
              date: d.date,
              message: d.message?.message || '',
              unreadCount: d.unreadCount,
              isGroup: d.isGroup,
              isChannel: d.isChannel
            }));
            set({ dialogs: formattedDialogs });
          }).catch(console.error);

          // Fetch contacts
          get().getContacts();

          // Listen for new messages
          client.addEventHandler((event: any) => {
            const message = event.message;
            if (message) {
              const chatId = message.chatId?.toString();
              if (chatId) {
                set((prev) => {
                  const currentMessages = prev.messages[chatId] || [];
                  const newMessage = {
                    id: message.id,
                    out: message.out,
                    message: message.message,
                    date: message.date,
                  };
                  return {
                    messages: {
                      ...prev.messages,
                      [chatId]: [newMessage, ...currentMessages]
                    }
                  };
                });
              }
            }
          }, new NewMessage({}));
        }
      }
    });
  },

  setAuthStep: (step) => set({ authStep: step }),
  setSessionString: (session) => set({ sessionString: session }),
  setError: (error) => set({ error }),
  
  setActiveDialog: (id) => {
    set({ activeDialogId: id });
    get().getMessages(id);
  },

  submitPhone: (phone) => useTdwebStore.getState().submitPhone(phone),
  submitCode: (code) => useTdwebStore.getState().submitCode(code),
  submitPassword: (password) => useTdwebStore.getState().submitPassword(password),
  
  sendMessage: async (message) => {
    const { activeDialogId } = get();
    const client = useTdwebStore.getState().client;
    if (!client || !activeDialogId) return;

    try {
      await client.sendMessage(activeDialogId, { message });
      // The new message event handler will add it to the state
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  },

  getMessages: async (entityId) => {
    const client = useTdwebStore.getState().client;
    if (!client) return;

    try {
      const msgs = await client.getMessages(entityId, { limit: 50 });
      const formattedMsgs = msgs.map((m: any) => ({
        id: m.id,
        out: m.out,
        message: m.message,
        date: m.date,
      }));
      
      set((prev) => ({
        messages: {
          ...prev.messages,
          [entityId]: formattedMsgs
        }
      }));
    } catch (err) {
      console.error('Failed to get messages:', err);
    }
  },

  getContacts: async () => {
    const client = useTdwebStore.getState().client;
    if (!client) return;

    try {
      const result = await client.invoke(new Api.contacts.GetContacts({
        hash: bigInt(0),
      }));
      
      if (result && 'users' in result) {
        const contacts = result.users.map((u: any) => ({
          id: u.id.toString(),
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
        }));
        set({ contacts });
      }
    } catch (err) {
      console.error('Failed to get contacts:', err);
    }
  },

  createGroup: async (title, userIds) => {
    const client = useTdwebStore.getState().client;
    if (!client) return;

    try {
      await client.invoke(new Api.messages.CreateChat({
        users: userIds,
        title: title,
      }));
      // Refresh dialogs
      const dialogs = await client.getDialogs({ limit: 20 });
      const formattedDialogs = dialogs.map((d: any) => ({
        id: d.id.toString(),
        title: d.title,
        date: d.date,
        message: d.message?.message || '',
        unreadCount: d.unreadCount,
        isGroup: d.isGroup,
        isChannel: d.isChannel
      }));
      set({ dialogs: formattedDialogs });
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  },

  importContact: async (phone, firstName, lastName) => {
    const client = useTdwebStore.getState().client;
    if (!client) return;

    try {
      await client.invoke(new Api.contacts.ImportContacts({
        contacts: [new Api.InputPhoneContact({
          clientId: bigInt(Math.floor(Math.random() * 1000000)),
          phone: phone,
          firstName: firstName,
          lastName: lastName,
        })]
      }));
      get().getContacts();
    } catch (err) {
      console.error('Failed to import contact:', err);
    }
  },

  setIncomingCall: (call) => set({ incomingCall: call }),
  setCallAccepted: (accepted) => set({ callAccepted: accepted }),
  setCallEnded: (ended) => set({ callEnded: ended }),
}));
