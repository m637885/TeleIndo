'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useConfigStore } from '@/store/useConfigStore';
import { Auth } from '@/components/Auth';
import { Chat } from '@/components/Chat';

export default function Home() {
  const { authStep, initSocket } = useAppStore();
  const { isTestServer } = useConfigStore();

  useEffect(() => {
    initSocket(isTestServer);
  }, [initSocket, isTestServer]);

  return (
    <main className="min-h-screen bg-slate-50">
      {authStep === 'authenticated' ? <Chat /> : <Auth />}
    </main>
  );
}
