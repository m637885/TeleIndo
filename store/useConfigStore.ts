import { create } from 'zustand';

interface ConfigState {
  isTestServer: boolean;
  setTestServer: (isTest: boolean) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  isTestServer: false,
  setTestServer: (isTest) => set({ isTestServer: isTest }),
}));
