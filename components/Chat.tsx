'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Send, Menu, Search, Phone, Video, MoreVertical, UserPlus, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { VideoCall } from './VideoCall';

export function Chat() {
  const { dialogs, contacts, messages, activeDialogId, setActiveDialog, sendMessage, createGroup, importContact, incomingCall } = useAppStore();
  const [input, setInput] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  
  const [importPhone, setImportPhone] = useState('');
  const [importFirstName, setImportFirstName] = useState('');
  const [importLastName, setImportLastName] = useState('');
  
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeDialog = dialogs.find(d => d.id === activeDialogId);
  const activeMessages = activeDialogId ? messages[activeDialogId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeDialogId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && activeDialogId) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  const handleImportContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (importPhone && importFirstName) {
      importContact(importPhone, importFirstName, importLastName);
      setShowImportModal(false);
      setImportPhone('');
      setImportFirstName('');
      setImportLastName('');
    }
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (groupTitle && selectedContacts.length > 0) {
      createGroup(groupTitle, selectedContacts);
      setShowGroupModal(false);
      setGroupTitle('');
      setSelectedContacts([]);
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleVideoCall = () => {
    if (activeDialog && !activeDialog.isGroup && !activeDialog.isChannel) {
      setShowVideoCall(true);
    } else {
      alert("Video calls are only supported in 1-on-1 chats.");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Video Call Overlay */}
      {(showVideoCall || incomingCall) && (
        <VideoCall 
          targetUserId={activeDialog?.id} 
          targetName={activeDialog?.title} 
          onClose={() => setShowVideoCall(false)} 
        />
      )}

      {/* Import Contact Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Import Contact</h2>
            <form onSubmit={handleImportContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={importPhone}
                  onChange={e => setImportPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={importFirstName}
                  onChange={e => setImportFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name (Optional)</label>
                <input
                  type="text"
                  value={importLastName}
                  onChange={e => setImportLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900">New Group</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 overflow-hidden">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupTitle}
                  onChange={e => setGroupTitle(e.target.value)}
                  placeholder="My Awesome Group"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto min-h-[200px] border border-slate-200 rounded-lg p-2">
                <label className="block text-sm font-medium text-slate-700 mb-2 px-1">Select Members</label>
                {contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 p-2 text-center">No contacts found.</p>
                ) : (
                  contacts.map(contact => (
                    <label key={contact.id} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        className="mr-3 rounded text-blue-500 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{contact.firstName} {contact.lastName}</p>
                        {contact.phone && <p className="text-xs text-slate-500">+{contact.phone}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!groupTitle || selectedContacts.length === 0}
                  className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 flex items-center gap-2">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-slate-100 pl-9 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <button 
            onClick={() => setShowGroupModal(true)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" 
            title="New Group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowImportModal(true)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors" 
            title="Import Contact"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {dialogs.map((dialog) => (
            <button
              key={dialog.id}
              onClick={() => setActiveDialog(dialog.id)}
              className={`w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left ${
                activeDialogId === dialog.id ? 'bg-blue-50 hover:bg-blue-50' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 text-white font-medium text-lg">
                {dialog.title?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-medium text-slate-900 truncate pr-2">
                    {dialog.title}
                  </h3>
                  {dialog.date && (
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {format(new Date(dialog.date * 1000), 'HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 truncate">
                  {dialog.message || 'No messages yet'}
                </p>
              </div>
              {dialog.unreadCount > 0 && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-medium flex-shrink-0">
                  {dialog.unreadCount}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      {activeDialog ? (
        <div className="flex-1 flex flex-col bg-[#E4E3E0] relative">
          {/* Chat Header */}
          <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                {activeDialog.title?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="font-medium text-slate-900">{activeDialog.title}</h2>
                <p className="text-xs text-slate-500">
                  {activeDialog.isGroup ? 'Group' : activeDialog.isChannel ? 'Channel' : 'last seen recently'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="Audio Call">
                <Phone className="w-5 h-5" />
              </button>
              <button 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors" 
                title="Video Call"
                onClick={handleVideoCall}
              >
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" title="More">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeMessages.slice().reverse().map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.out ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${
                    msg.out
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white text-slate-900 rounded-bl-sm'
                  }`}
                >
                  <p className="text-[15px] leading-relaxed break-words">{msg.message}</p>
                  <div
                    className={`text-[11px] mt-1 text-right ${
                      msg.out ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {format(new Date(msg.date * 1000), 'HH:mm')}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-transparent">
            <form
              onSubmit={handleSend}
              className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm flex items-end gap-2 p-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder="Write a message..."
                className="flex-1 max-h-32 min-h-[44px] resize-none bg-transparent border-0 focus:ring-0 p-3 text-[15px] leading-relaxed"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-3 text-blue-500 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent flex-shrink-0 mb-1"
              >
                <Send className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-[#E4E3E0]">
          <div className="bg-white/50 px-4 py-2 rounded-full text-sm text-slate-500 font-medium">
            Select a chat to start messaging
          </div>
        </div>
      )}
    </div>
  );
}
