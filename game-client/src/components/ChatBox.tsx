import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';

export interface Message {
  id: string;
  text: string;
  sender: string; // nickname or 'System'
  type: 'chat' | 'system';
  createdAt: any;
}

interface ChatBoxProps {
    nickname: string;
    hp?: number;
    maxHp?: number;
    mp?: number;
    maxMp?: number;
    localSystemLogs?: Message[];
    onCommand?: (command: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ nickname, hp = 100, maxHp = 100, mp = 50, maxMp = 50, localSystemLogs = [], onCommand }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [firestoreSystemLogs, setFirestoreSystemLogs] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'system'>('system'); // Default to system to see logs
  const [input, setInput] = useState('');
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const sysScrollRef = useRef<HTMLDivElement>(null);

  // Helper to get milliseconds from various timestamp formats
  const getMillis = (t: any) => {
      if (!t) return 0;
      if (typeof t === 'number') return t;
      if (t.toMillis) return t.toMillis(); // Firestore Timestamp
      if (t instanceof Date) return t.getTime();
      return 0;
  };

  // Subscribe to ALL messages
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Fallback for local timestamp issues
        const msg: Message = { 
            id: doc.id, 
            text: data.text, 
            sender: data.sender, 
            type: data.type || 'chat', // Default to chat if undefined
            createdAt: data.createdAt 
        };
        allMsgs.push(msg);
      });
      
      const sorted = allMsgs.reverse();
      
      setMessages(sorted.filter(m => m.type !== 'system'));
      setFirestoreSystemLogs(sorted.filter(m => m.type === 'system'));
    });

    return () => unsubscribe();
  }, []);

  // Combine Firestore logs and Local logs
  const combinedSystemLogs = [...firestoreSystemLogs, ...localSystemLogs].sort((a, b) => {
      return getMillis(a.createdAt) - getMillis(b.createdAt);
  });

  // Auto-scroll
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
    if (activeTab === 'system' && sysScrollRef.current) {
        sysScrollRef.current.scrollTop = sysScrollRef.current.scrollHeight;
    }
  }, [messages, combinedSystemLogs, activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Handle Admin Commands
    if (input.startsWith('/') && onCommand) {
        onCommand(input);
        setInput('');
        return;
    }

    try {
      await addDoc(collection(db, 'chats'), {
        text: input,
        sender: nickname,
        type: 'chat',
        createdAt: serverTimestamp()
      });
      setInput('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 text-white text-sm font-sans border border-slate-700 relative">
        
      {/* HP/MP Bar Overlay (Top of Chat) */}
      <div className="absolute -top-12 left-0 w-full bg-slate-800 p-1 border border-slate-600 rounded-t flex flex-col gap-1 shadow-lg z-10">
          {/* HP */}
          <div className="relative h-4 w-full bg-gray-700 rounded overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-300" 
                style={{ width: `${(hp / maxHp) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                  HP {Math.round(hp)} / {maxHp}
              </div>
          </div>
          {/* MP */}
          <div className="relative h-4 w-full bg-gray-700 rounded overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300" 
                style={{ width: `${(mp / maxMp) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                  MP {Math.round(mp)} / {maxMp}
              </div>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 bg-slate-800 mt-1"> {/* Added margin top if needed */}
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-1 text-center font-bold text-xs transition-colors
            ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
        >
          채팅
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={`flex-1 py-1 text-center font-bold text-xs transition-colors
            ${activeTab === 'system' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
        >
          시스템
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Chat Tab */}
        <div 
            ref={chatScrollRef}
            className={`absolute inset-0 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-600
                ${activeTab === 'chat' ? 'block' : 'hidden'}`}
        >
            {messages.map((msg) => (
            <div key={msg.id} className="break-words">
                <span className={`font-bold ${msg.sender === nickname ? 'text-yellow-400' : 'text-blue-400'}`}>
                {msg.sender}:
                </span>
                <span className="ml-1 text-slate-200">{msg.text}</span>
            </div>
            ))}
        </div>

        {/* System Tab */}
        <div 
            ref={sysScrollRef}
            className={`absolute inset-0 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-600 font-mono text-xs
                ${activeTab === 'system' ? 'block' : 'hidden'}`}
        >
            {combinedSystemLogs.length === 0 && (
                <div className="text-slate-500 italic text-center mt-4">시스템 메시지가 없습니다.</div>
            )}
            {combinedSystemLogs.map((msg) => (
            <div key={msg.id} className="break-words text-green-300">
                [System] {msg.text}
            </div>
            ))}
        </div>
      </div>

      {/* Input Area (Only for Chat Tab) */}
      {activeTab === 'chat' && (
        <form onSubmit={handleSend} className="p-1 border-t border-slate-700 flex bg-slate-800">
            <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white px-2 py-1 placeholder-slate-500"
            placeholder="메시지 입력..."
            />
            <button 
            type="submit" 
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold transition"
            >
            전송
            </button>
        </form>
      )}
    </div>
  );
};
