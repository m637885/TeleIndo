import express from 'express';
import next from 'next';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import { NewMessage } from 'telegram/events/index.js';
import bigInt from 'big-integer';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  const connectedUsers = new Map<string, string>(); // telegramUserId -> socket.id

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let currentClient: TelegramClient | null = null;
    let currentSessionString = '';
    let currentUserId = '';

    // Resolvers for client.start()
    let resolvePhone: ((phone: string) => void) | null = null;
    let resolveCode: ((code: string) => void) | null = null;
    let resolvePassword: ((password: string) => void) | null = null;

    socket.on('init', async ({ sessionString, isTestServer }) => {
      try {
        const apiId = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        if (!apiId || !apiHash) {
          socket.emit('error', { message: 'API ID and Hash are not configured on the server' });
          return;
        }

        const stringSession = new StringSession(sessionString || '');
        currentClient = new TelegramClient(stringSession, Number(apiId), apiHash, {
          connectionRetries: 5,
          testServers: isTestServer || process.env.TELEGRAM_TEST_SERVERS === 'true',
        });

        await currentClient.connect();
        currentSessionString = currentClient.session.save() as unknown as string;
        
        const me = await currentClient.getMe();
        currentUserId = me.id.toString();
        connectedUsers.set(currentUserId, socket.id);

        // Listen for new messages
        currentClient.addEventHandler((event: any) => {
          if (event.message) {
            socket.emit('newMessage', {
              message: event.message,
            });
          }
        }, new NewMessage({}));

        socket.emit('init_success', { sessionString: currentSessionString, userId: currentUserId });
      } catch (err: any) {
        console.error('Init error:', err);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('startAuth', async ({ isTestServer } = {}) => {
      if (!currentClient) {
        const apiId = process.env.TELEGRAM_API_ID;
        const apiHash = process.env.TELEGRAM_API_HASH;
        if (!apiId || !apiHash) {
          socket.emit('error', { message: 'API ID and Hash are not configured on the server' });
          return;
        }
        const stringSession = new StringSession('');
        currentClient = new TelegramClient(stringSession, Number(apiId), apiHash, {
          connectionRetries: 5,
          testServers: isTestServer || process.env.TELEGRAM_TEST_SERVERS === 'true',
        });
      }
      try {
        await currentClient.start({
          phoneNumber: async () => {
            socket.emit('needPhone');
            return new Promise((resolve) => {
              resolvePhone = resolve;
            });
          },
          password: async () => {
            socket.emit('needPassword');
            return new Promise((resolve) => {
              resolvePassword = resolve;
            });
          },
          phoneCode: async () => {
            socket.emit('needCode');
            return new Promise((resolve) => {
              resolveCode = resolve;
            });
          },
          onError: (err) => {
            socket.emit('error', { message: err.message });
          },
        });
        currentSessionString = currentClient.session.save() as unknown as string;
        
        const me = await currentClient.getMe();
        currentUserId = me.id.toString();
        connectedUsers.set(currentUserId, socket.id);
        
        socket.emit('signIn_success', { sessionString: currentSessionString, userId: currentUserId });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    // WebRTC Signaling
    socket.on('callUser', ({ userToCall, signalData, from, name }) => {
      const socketId = connectedUsers.get(userToCall);
      if (socketId) {
        io.to(socketId).emit('incomingCall', { signal: signalData, from, name });
      } else {
        socket.emit('callError', { message: 'User is not online in this web app.' });
      }
    });

    socket.on('answerCall', ({ to, signal }) => {
      const socketId = connectedUsers.get(to);
      if (socketId) {
        io.to(socketId).emit('callAccepted', signal);
      }
    });

    socket.on('endCall', ({ to }) => {
      const socketId = connectedUsers.get(to);
      if (socketId) {
        io.to(socketId).emit('callEnded');
      }
    });

    socket.on('submitPhone', ({ phoneNumber }) => {
      if (resolvePhone) resolvePhone(phoneNumber);
    });

    socket.on('submitCode', ({ code }) => {
      if (resolveCode) resolveCode(code);
    });

    socket.on('submitPassword', ({ password }) => {
      if (resolvePassword) resolvePassword(password);
    });

    socket.on('getDialogs', async () => {
      if (!currentClient) return;
      try {
        const dialogs = await currentClient.getDialogs();
        socket.emit('dialogs', dialogs.map(d => ({
          id: d.id?.toString(),
          title: d.title,
          unreadCount: d.unreadCount,
          isGroup: d.isGroup,
          isChannel: d.isChannel,
          date: d.date,
          message: d.message?.message,
        })));
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('getMessages', async ({ entityId, limit = 50 }) => {
      if (!currentClient) return;
      try {
        const messages = await currentClient.getMessages(entityId, { limit });
        socket.emit('messages', {
          entityId,
          messages: messages.map(m => ({
            id: m.id,
            message: m.message,
            date: m.date,
            out: m.out,
            senderId: m.senderId?.toString(),
          }))
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('getContacts', async () => {
      if (!currentClient) return;
      try {
        const contacts = await currentClient.invoke(new Api.contacts.GetContacts({ hash: bigInt(0) }));
        if ('users' in contacts) {
          socket.emit('contacts', contacts.users.map((u: any) => ({
            id: u.id?.toString(),
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username,
            phone: u.phone
          })));
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('createGroup', async ({ title, userIds }) => {
      if (!currentClient) return;
      try {
        await currentClient.invoke(new Api.messages.CreateChat({
          users: userIds,
          title: title
        }));
        socket.emit('groupCreated', { success: true });
        // Refresh dialogs
        const dialogs = await currentClient.getDialogs();
        socket.emit('dialogs', dialogs.map(d => ({
          id: d.id?.toString(),
          title: d.title,
          unreadCount: d.unreadCount,
          isGroup: d.isGroup,
          isChannel: d.isChannel,
          date: d.date,
          message: d.message?.message,
        })));
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('sendMessage', async ({ entityId, message }) => {
      if (!currentClient) return;
      try {
        await currentClient.sendMessage(entityId, { message });
        socket.emit('messageSent', { success: true });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('importContact', async ({ phone, firstName, lastName }) => {
      if (!currentClient) return;
      try {
        await currentClient.invoke(
          new Api.contacts.ImportContacts({
            contacts: [
              new Api.InputPhoneContact({
                clientId: bigInt(Math.floor(Math.random() * 1000000)),
                phone,
                firstName,
                lastName: lastName || '',
              }),
            ],
          })
        );
        socket.emit('contactImported', { success: true });
        // Refresh dialogs
        const dialogs = await currentClient.getDialogs();
        socket.emit('dialogs', dialogs.map(d => ({
          id: d.id?.toString(),
          title: d.title,
          unreadCount: d.unreadCount,
          isGroup: d.isGroup,
          isChannel: d.isChannel,
          date: d.date,
          message: d.message?.message,
        })));
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (currentUserId) {
        connectedUsers.delete(currentUserId);
      }
      if (currentClient) {
        currentClient.disconnect();
      }
    });
  });

  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    return handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
