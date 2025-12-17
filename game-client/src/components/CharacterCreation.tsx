import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface CharacterCreationProps {
  onCharacterCreated: () => void;
}

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onCharacterCreated }) => {
  const [nickname, setNickname] = useState('');
  const [selectedClass, setSelectedClass] = useState<'sword' | 'shield' | 'mage' | 'archer'>('sword');
  const [loading, setLoading] = useState(false);

  const classes = [
    { id: 'sword', name: '전사 (Sword)', desc: '강력한 근접 공격' },
    { id: 'shield', name: '가디언 (Shield)', desc: '높은 방어력과 체력' },
    { id: 'mage', name: '마법사 (Mage)', desc: '강력한 마법 공격' },
    { id: 'archer', name: '궁수 (Archer)', desc: '원거리 공격' },
  ];

  const handleCreate = async () => {
    if (!nickname.trim()) {
      alert('닉네임을 입력해주세요.');
      return;
    }
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Check if nickname is unique (Optional, skipping for simple implementation)
      
      // 직업별 초기 스탯 설정 (공격력 상향)
      let initialStats = {
        str: 5,
        dex: 5,
        int: 5,
        luk: 5,
        hp: 0,
        mp: 0
      };

      // 직업별 특화 스탯 부여 (대폭 상향)
      if (selectedClass === 'sword') {
        initialStats.str = 30; // 전사: STR 30 (공격력 150)
        initialStats.hp = 3;   // HP +300
        initialStats.dex = 8;  // 방어력
      } else if (selectedClass === 'archer') {
        initialStats.dex = 40; // 궁수: DEX 40 (공격력 120)
        initialStats.luk = 15; // 행운 보너스
        initialStats.str = 5;
      } else if (selectedClass === 'mage') {
        initialStats.int = 35; // 마법사: INT 35 (공격력 140)
        initialStats.mp = 5;   // MP +100
        initialStats.str = 5;
      } else if (selectedClass === 'shield') {
        initialStats.str = 20; // 가디언: STR 20 (공격력 60)
        initialStats.hp = 8;   // HP +800
        initialStats.dex = 15; // 방어력
      }

      // 초기 장비 지급 (직업별)
      const initialEquipment = {
        head: null,
        armor: null,
        leg: null,
        weapon: null
      };

      const initialInventory = [];

      // 직업별 초기 무기 지급
      if (selectedClass === 'sword') {
        initialEquipment.weapon = {
          itemId: 'starter_sword',
          name: '초보자의 검',
          type: 'equipment',
          subType: 'weapon',
          stats: { attack: 30 },
          grade: 'common'
        };
      } else if (selectedClass === 'archer') {
        initialEquipment.weapon = {
          itemId: 'starter_bow',
          name: '초보자의 활',
          type: 'equipment',
          subType: 'weapon',
          stats: { attack: 25 },
          grade: 'common'
        };
      } else if (selectedClass === 'mage') {
        initialEquipment.weapon = {
          itemId: 'starter_staff',
          name: '초보자의 지팡이',
          type: 'equipment',
          subType: 'weapon',
          stats: { attack: 28 },
          grade: 'common'
        };
      } else if (selectedClass === 'shield') {
        initialEquipment.weapon = {
          itemId: 'starter_mace',
          name: '초보자의 둔기',
          type: 'equipment',
          subType: 'weapon',
          stats: { attack: 20 },
          grade: 'common'
        };
      }

      // 초기 물약 지급
      initialInventory.push({
        itemId: 'potion_hp_small',
        name: '하급 체력 물약',
        type: 'consumable',
        subType: 'potion',
        effect: { type: 'heal_hp', amount: 50 },
        amount: 10,
        stackable: true
      });

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        nickname: nickname,
        class: selectedClass,
        level: 1,
        exp: 0,
        gold: 2000, // 초기 골드 2000G
        statPoints: 0,
        stats: initialStats,
        equipment: initialEquipment,
        inventory: initialInventory,
        position: { x: 400, y: 300 },
        createdAt: new Date()
      });

      onCharacterCreated();
    } catch (error) {
      console.error("Error creating character:", error);
      alert('캐릭터 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-400">캐릭터 생성</h1>
        
        {/* Nickname Input */}
        <div className="mb-8">
            <label className="block text-lg mb-2 text-slate-300">닉네임</label>
            <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-lg focus:border-blue-500 outline-none"
                placeholder="사용할 닉네임을 입력하세요"
                maxLength={10}
            />
        </div>

        {/* Class Selection */}
        <div className="mb-8">
            <label className="block text-lg mb-4 text-slate-300">직업 선택</label>
            <div className="grid grid-cols-2 gap-4">
                {classes.map((cls) => (
                    <div 
                        key={cls.id}
                        onClick={() => setSelectedClass(cls.id as any)}
                        className={`p-4 border-2 rounded cursor-pointer transition flex flex-col items-center gap-2
                            ${selectedClass === cls.id 
                                ? 'border-blue-500 bg-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                                : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700'}`}
                    >
                        {/* Preview Image */}
                        <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center overflow-hidden">
                             <img 
                                src={`/sprites/ske_${cls.id}/${cls.id}_blue/ready_1.png`} 
                                alt={cls.name}
                                className="object-contain h-full"
                             />
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg">{cls.name}</div>
                            <div className="text-xs text-slate-400">{cls.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <button 
            onClick={handleCreate}
            disabled={loading}
            className={`w-full py-4 rounded text-xl font-bold transition
                ${loading 
                    ? 'bg-slate-600 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}`}
        >
            {loading ? '생성 중...' : '게임 시작'}
        </button>
      </div>
    </div>
  );
};

