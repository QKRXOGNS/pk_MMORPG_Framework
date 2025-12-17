import { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Login } from './components/Login';
import { CharacterCreation } from './components/CharacterCreation';
import { auth, db } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { ChatBox, type Message } from './components/ChatBox';
import { GRADE_NAMES } from './data/gameData';
import { usePotionSystem } from './hooks/usePotionSystem';
import { useInventorySystem } from './hooks/useInventorySystem';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [characterData, setCharacterData] = useState<any>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing Auth...");
  
  // Live Stats State (Synced from GameCanvas/Server)
  const [currentHp, setCurrentHp] = useState(500);
  const [currentMp, setCurrentMp] = useState(300);
  
  // Track previous level for level-up detection
  const prevLevelRef = useRef<number>(1);

  // Local System Logs (Combat logs, etc. - Not saved to DB)
  const [localSystemLogs, setLocalSystemLogs] = useState<Message[]>([]);

  // Add a local log
  const handleAddLog = (text: string) => {
      const newLog: Message = {
          id: `local_${Date.now()}_${Math.random()}`,
          text,
          sender: 'System',
          type: 'system',
          createdAt: Date.now()
      };
      setLocalSystemLogs(prev => {
          const newState = [...prev, newLog];
          if (newState.length > 50) return newState.slice(newState.length - 50);
          return newState;
      });
  };

  // Command State
  const [commandTrigger, setCommandTrigger] = useState<{cmd: string, id: number} | null>(null);

  // Potion System State (Lifted Up)
  const [equippedPotionId, setEquippedPotionId] = useState<string | null>(null);

  // --- Inventory System (Hook) ---
  const {
      inventory, setInventory,
      equipment, setEquipment,
      gold, setGold,
      disassembleMode, setDisassembleMode,
      selectedItems, setSelectedItems,
      autoDisassembleSettings, setAutoDisassembleSettings,
      handleInventoryAdd,
      handleEquip,
      handleUnequip,
      handleDisassembleSelected,
      toggleItemSelection
  } = useInventorySystem({
      characterData,
      handleAddLog,
      onPotionEquip: (itemId, name) => {
           setEquippedPotionId(itemId);
           handleAddLog(`[System] ${name} 장착 완료.`);
      },
      onEquipmentChange: (newEquipment) => {
           if (characterData?.stats) {
               const updatedStats = calculatePlayerStatsWithEquipment(characterData.stats, newEquipment);
               setStatsSyncTrigger({ stats: updatedStats, id: Date.now() });
           }
      }
  });

  
  // Stats Sync Trigger (for manual sync only)
  const [statsSyncTrigger, setStatsSyncTrigger] = useState<{stats: any, id: number} | null>(null);

  // Derived Stats Constants
  const BASE_HP = 500;
  const BASE_MP = 300;

  // Helper: Calculate player stats for server sync (with explicit equipment parameter)
  const calculatePlayerStatsWithEquipment = (baseStats: any, equip: any, classTypeOverride?: string) => {
      const getStat = (item: any, statName: string) => {
          const val = item?.stats?.[statName];
          return typeof val === 'number' ? val : 0;
      };

      const equipmentList = Object.values(equip || {}) as any[];

      const baseStr = baseStats.str + equipmentList.reduce((a: number, i: any) => a + getStat(i, 'str'), 0);
      const baseDex = baseStats.dex + equipmentList.reduce((a: number, i: any) => a + getStat(i, 'dex'), 0);
      const baseInt = baseStats.int + equipmentList.reduce((a: number, i: any) => a + getStat(i, 'int'), 0);
      const baseLuk = baseStats.luk + equipmentList.reduce((a: number, i: any) => a + getStat(i, 'luk'), 0);
      
      const classType = classTypeOverride || characterData?.class || 'sword';
      let jobAttack = 0;
      if (classType === 'sword') {
          jobAttack = baseStr * 5;
      } else if (classType === 'archer') {
          jobAttack = baseDex * 3;
      } else if (classType === 'mage') {
          jobAttack = baseInt * 4;
      } else if (classType === 'shield') {
          jobAttack = baseStr * 3;
      }
      
      const equipAttack = equipmentList.reduce((a: number, i: any) => a + getStat(i, 'attack'), 0);
      const equipHp = equipmentList.reduce((a: number, i: any) => a + getStat(i, 'hp'), 0);
      const equipMp = equipmentList.reduce((a: number, i: any) => a + getStat(i, 'mp'), 0);
      
      return {
          str: baseStr,
          dex: baseDex,
          int: baseInt,
          luk: baseLuk,
          attack: jobAttack + equipAttack,
          hp: BASE_HP + (baseStats.hp * 100) + equipHp,
          mp: BASE_MP + (baseStats.mp * 20) + equipMp,
          class: classType
      };
  };

  // Pending Stats for Allocation (Using Deltas/AllocatedPoints now)
  const [allocatedPoints, setAllocatedPoints] = useState<any>({
      str: 0, dex: 0, int: 0, luk: 0, hp: 0, mp: 0
  });

  // Derived Stats Calculation
  const calculateTotalStats = () => {
      if (!characterData || !characterData.stats) return null;
      
      const base = characterData.stats;
      const allocated = allocatedPoints;
      
      // Effective Base = Committed Base + Allocated Deltas
      const effectiveBase = {
          str: base.str + allocated.str,
          dex: base.dex + allocated.dex,
          int: base.int + allocated.int,
          luk: base.luk + allocated.luk,
          hp: base.hp + allocated.hp,
          mp: base.mp + allocated.mp
      };

      const bonus = { str: 0, dex: 0, int: 0, luk: 0, hp: 0, mp: 0, attack: 0, defense: 0 };

      Object.values(equipment).forEach(item => {
          if (item && item.stats) {
              if (item.stats.str) bonus.str += item.stats.str;
              if (item.stats.dex) bonus.dex += item.stats.dex;
              if (item.stats.int) bonus.int += item.stats.int;
              if (item.stats.luk) bonus.luk += item.stats.luk;
              if (item.stats.hp) bonus.hp += item.stats.hp;
              if (item.stats.mp) bonus.mp += item.stats.mp;
              if (item.stats.attack) bonus.attack += item.stats.attack;
              if (item.stats.defense) bonus.defense += item.stats.defense;
          }
      });

      // Derived Stats
      // HP = Base + (HP_Points * 100) + Item Bonus
      const calculatedMaxHp = BASE_HP + ((effectiveBase.hp || 0) * 100) + bonus.hp;
      const calculatedMaxMp = BASE_MP + ((effectiveBase.mp || 0) * 20) + bonus.mp;
      
      // Job-based Attack Calculation (for UI display)
      const classType = characterData.class || 'sword';
      let jobAttack = 0;
      if (classType === 'sword') {
          jobAttack = effectiveBase.str * 5; // 전사: STR * 5
      } else if (classType === 'archer') {
          jobAttack = effectiveBase.dex * 3; // 궁수: DEX * 3
      } else if (classType === 'mage') {
          jobAttack = effectiveBase.int * 4; // 마법사: INT * 4
      } else if (classType === 'shield') {
          jobAttack = effectiveBase.str * 3; // 가디언: STR * 3
      }
      
      const totalAttack = jobAttack + bonus.attack;
      const totalDefense = (effectiveBase.dex * 1) + bonus.defense;

      return {
          base: effectiveBase,
          bonus,
          total: {
              ...effectiveBase,
              str: effectiveBase.str + bonus.str,
              dex: effectiveBase.dex + bonus.dex,
              int: effectiveBase.int + bonus.int,
              luk: effectiveBase.luk + bonus.luk,
              hp: calculatedMaxHp,
              mp: calculatedMaxMp,
              attack: totalAttack,
              defense: totalDefense
          }
      };
  };

  const statsInfo = calculateTotalStats();

  // Calculate Available Points
  const totalAllocated = Object.values(allocatedPoints).reduce((a: any, b: any) => a + b, 0) as number;
  const availablePoints = (characterData?.statPoints || 0) - totalAllocated;

  // Helper to render stat line
  const renderStat = (label: string, statKey: string, totalVal: number) => {
      if (!characterData) return null;
      
      const currentAllocated = allocatedPoints[statKey];
      
      return (
          <div className="flex items-center justify-between my-1 px-1 py-1 bg-slate-700/30 rounded">
              <span className="font-bold text-gray-300 w-6 text-[10px] shrink-0">{label}</span>
              
              {/* Controls & Value Wrapper */}
              <div className="flex items-center gap-1">
                  {/* Decrease */}
                  <button 
                      onClick={() => handleStatChange(statKey, -1)}
                      disabled={currentAllocated <= 0}
                      className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors shrink-0
                          ${currentAllocated > 0 
                              ? 'text-blue-400 hover:text-blue-300 hover:bg-slate-600' 
                              : 'text-gray-600 cursor-default opacity-30'}`}
                  >
                      ◀
                  </button>
                  
                  {/* Value */}
                  <span className="text-center w-10 font-mono text-white text-xs font-bold shrink-0">
                      {totalVal}
                  </span>
                  
                  {/* Increase */}
                  <button 
                      onClick={() => handleStatChange(statKey, 1)}
                      disabled={availablePoints <= 0}
                      className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors shrink-0
                          ${availablePoints > 0 
                              ? 'text-red-400 hover:text-red-300 hover:bg-slate-600' 
                              : 'text-gray-600 cursor-default opacity-30'}`}
                  >
                      ▶
                  </button>
              </div>
          </div>
      );
  };

  const handleStatChange = (statKey: string, change: number) => {
      setAllocatedPoints((prev: any) => {
          const currentVal = prev[statKey];
          // Check limits
          if (change > 0 && availablePoints > 0) {
              return { ...prev, [statKey]: currentVal + 1 };
          } else if (change < 0 && currentVal > 0) {
              return { ...prev, [statKey]: currentVal - 1 };
          }
          return prev;
      });
  };

  const applyStats = async () => {
      if (totalAllocated === 0 || !user) return;
      
      const newStats = { ...characterData.stats };
      Object.keys(allocatedPoints).forEach(key => {
          newStats[key] += allocatedPoints[key];
      });
      
      const newStatPoints = characterData.statPoints - totalAllocated;

      try {
          await setDoc(doc(db, 'users', user.uid), {
              stats: newStats,
              statPoints: newStatPoints
          }, { merge: true });
          
          // Update local character data to reflect commit
          setCharacterData((prev: any) => ({
              ...prev,
              stats: newStats,
              statPoints: newStatPoints
          }));
          
          // Reset allocation
          setAllocatedPoints({ str: 0, dex: 0, int: 0, luk: 0, hp: 0, mp: 0 });
          
          // Trigger stats sync to server
          // Use current equipment state as new stats don't change equipment
          const updatedStats = calculatePlayerStatsWithEquipment(newStats, equipment);
          setStatsSyncTrigger({ stats: updatedStats, id: Date.now() });
          
          handleAddLog("스탯이 적용되었습니다.");
      } catch (err) {
          console.error("Error saving stats:", err);
      }
  };
  
  const handleExpGain = (amount: number) => {
      setCharacterData((prev: any) => {
          if (!prev) return prev;
          
          let newExp = (prev.exp || 0) + amount;
          let newLevel = prev.level || 1;
          let newStatPoints = prev.statPoints || 0;
          
          // Simple Level Up Formula: Level * 100 EXP needed
          const expNeeded = newLevel * 100;
          
          if (newExp >= expNeeded) {
              newLevel++;
              newExp -= expNeeded;
              newStatPoints += 5;
              // We can't log from here easily without effect, but simpler is better
          }
          
          return {
              ...prev,
              level: newLevel,
              exp: newExp,
              statPoints: newStatPoints
          };
      });
  };


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
// ... rest of the file

      setStatusMessage("Auth State Changed: " + (currentUser ? "Logged In" : "Logged Out"));
      setUser(currentUser);
      
      if (currentUser) {
        setCheckingProfile(true);
        setStatusMessage("Checking User Profile in DB...");
        try {
          // Check DB for profile
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setStatusMessage("Profile Found. Loading Game...");
            const data = userDoc.data();
            setCharacterData(data);
            // Initialize previous level tracking
            prevLevelRef.current = data.level || 1;
            // Load State
            if (data.inventory) setInventory(data.inventory);
            if (data.gold) setGold(data.gold || 0);
            if (data.equipment) setEquipment(data.equipment);
            
            // Trigger initial stats sync to ensure server has correct attack value
            const initialEquip = data.equipment || { head: null, armor: null, leg: null, weapon: null };
            if (data.stats) {
                const initialStats = calculatePlayerStatsWithEquipment(data.stats, initialEquip, data.class);
                setStatsSyncTrigger({ stats: initialStats, id: Date.now() });

                // Fix: Initialize HP/MP to Max on Login (to prevent 500 HP bug)
                if (initialStats) {
                    setCurrentHp(initialStats.hp);
                    setCurrentMp(initialStats.mp);
                }
            }
          } else {
            setStatusMessage("No Profile. Going to Creation...");
            setCharacterData(null); // No profile -> Trigger creation flow
          }
        } catch (err: any) {
          console.error("Error fetching profile:", err);
          setStatusMessage("Error: " + err.message);
          // 권한 오류일 경우 처리
          if (err.code === 'permission-denied') {
             alert("데이터베이스 권한이 없습니다. 파이어베이스 콘솔 -> Firestore -> 규칙(Rules)을 확인해주세요.");
          }
        }
        setCheckingProfile(false);
      } else {
        setCharacterData(null);
        // Clear states on logout
        setInventory([]);
        setGold(0);
        setEquipment({ head: null, armor: null, leg: null, weapon: null });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Update HP/MP from GameCanvas
  const handleStatsUpdate = (hp: number, mp: number) => {
      // Prevent server's low HP from overwriting level-up HP recovery
      setCurrentHp((prevHp) => {
          if (prevHp === undefined || prevHp === 0) return hp;
          if (hp < prevHp || hp > prevHp) {
              if (hp < prevHp * 0.5 && prevHp > 1000) {
                  console.warn(`[Client] Ignoring stale HP update: server=${hp}, client=${prevHp}`);
                  return prevHp;
              }
              return hp;
          }
          return prevHp;
      });
      setCurrentMp(mp);
  };

  // --- Potion System (Hook) ---
  const {
      autoPotionSettings,
      setAutoPotionSettings,
      potionCooldownEnd,
      showPotionSettings,
      setShowPotionSettings,
      cooldownProgress,
      usePotion,
      handlePotionEquip
  } = usePotionSystem({
      inventory,
      setInventory,
      currentHp,
      setCurrentHp,
      statsInfo,
      handleAddLog,
      equippedPotionId,
      setEquippedPotionId
  });
  // ---------------------

  const handleCharacterCreated = async () => {
    if (!auth.currentUser) return;
    setCheckingProfile(true);
    setStatusMessage("Reloading Profile...");
    // Refresh profile data
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userDoc.exists()) {
        setCharacterData(userDoc.data());
    }
    setCheckingProfile(false);
  };

  // Sync State to DB (Throttled/Debounced can be better, but keeping simple)
  // Split effects to avoid overwriting stale data on race conditions

  // 1. Sync Inventory/Gold/Equipment
  useEffect(() => {
      if (!user || !characterData) return;
      const saveData = async () => {
          try {
              await setDoc(doc(db, 'users', user.uid), {
                  inventory,
                  gold,
                  equipment
              }, { merge: true });
          } catch (err) {
              console.error("Error saving inv data:", err);
          }
      };
      saveData();
  }, [inventory, gold, equipment, user]);

  // 2. Sync Character Progression (Level, EXP, StatPoints, Stats, Derived Stats)
  useEffect(() => {
      if (!user || !characterData) return;
      const saveData = async () => {
          try {
              // Calculate derived stats for DB storage (same as UI calculation)
              const base = characterData.stats;
              const bonus = { str: 0, dex: 0, int: 0, luk: 0, hp: 0, mp: 0, attack: 0, defense: 0 };

              Object.values(equipment).forEach(item => {
                  if (item && item.stats) {
                      if (item.stats.hp) bonus.hp += item.stats.hp;
                      if (item.stats.mp) bonus.mp += item.stats.mp;
                      if (item.stats.attack) bonus.attack += item.stats.attack;
                      if (item.stats.defense) bonus.defense += item.stats.defense;
                  }
              });

              // Job-based Attack Calculation (same as UI)
              const classType = characterData.class || 'sword';
              let jobAttack = 0;
              if (classType === 'sword') {
                  jobAttack = base.str * 5; // 전사: STR * 5
              } else if (classType === 'archer') {
                  jobAttack = base.dex * 3; // 궁수: DEX * 3
              } else if (classType === 'mage') {
                  jobAttack = base.int * 4; // 마법사: INT * 4
              } else if (classType === 'shield') {
                  jobAttack = base.str * 3; // 가디언: STR * 3
              }
              
              const totalAttack = jobAttack + bonus.attack;
              const totalDefense = (base.dex * 1) + bonus.defense;
              const maxHp = BASE_HP + ((base.hp || 0) * 100) + bonus.hp;
              const maxMp = BASE_MP + ((base.mp || 0) * 20) + bonus.mp;

              await setDoc(doc(db, 'users', user.uid), {
                  level: characterData.level,
                  exp: characterData.exp,
                  statPoints: characterData.statPoints,
                  stats: characterData.stats,
                  // Save Derived Stats (same as UI display)
                  attack: totalAttack,
                  defense: totalDefense,
                  maxHp: maxHp,
                  maxMp: maxMp
              }, { merge: true });
          } catch (err) {
              console.error("Error saving char data:", err);
          }
      };
      saveData();
  }, [characterData, user, equipment]);

  // Level Up: Fill HP to Max when level increases
  useEffect(() => {
      if (!characterData || !characterData.level) return;
      
      const currentLevel = characterData.level;
      const prevLevel = prevLevelRef.current;
      
      // Check if level increased
      if (currentLevel > prevLevel) {
          // Calculate max HP (same as UI calculation)
          const base = characterData.stats;
          const allocated = allocatedPoints;
          
          // Effective Base = Committed Base + Allocated Deltas
          const effectiveBase = {
              str: base.str + allocated.str,
              dex: base.dex + allocated.dex,
              int: base.int + allocated.int,
              luk: base.luk + allocated.luk,
              hp: base.hp + allocated.hp,
              mp: base.mp + allocated.mp
          };

          const bonus = { str: 0, dex: 0, int: 0, luk: 0, hp: 0, mp: 0, attack: 0, defense: 0 };

          Object.values(equipment).forEach(item => {
              if (item && item.stats) {
                  if (item.stats.hp) bonus.hp += item.stats.hp;
                  if (item.stats.mp) bonus.mp += item.stats.mp;
              }
          });

          // Calculate Max HP
          const calculatedMaxHp = BASE_HP + ((effectiveBase.hp || 0) * 100) + bonus.hp;
          
          // Calculate full stats for server sync (to update maxHp first)
          const calculatedStats = calculatePlayerStatsWithEquipment(characterData.stats, equipment);
          
          // First, sync stats to server to update maxHp
          if (calculatedStats) {
              setStatsSyncTrigger({ stats: calculatedStats, id: Date.now() });
          }
          
          // Then, update HP after a short delay to ensure server has updated maxHp
          setTimeout(() => {
              setCurrentHp(calculatedMaxHp);
              handleAddLog(`레벨업! HP가 최대치로 회복되었습니다. (${calculatedMaxHp})`);
          }, 100); // Small delay to ensure server processes updateStats first
          
          // Update previous level
          prevLevelRef.current = currentLevel;
      } else if (currentLevel < prevLevel) {
          // Level decreased (shouldn't happen, but reset tracking)
          prevLevelRef.current = currentLevel;
      }
  }, [characterData?.level, characterData?.stats, equipment, allocatedPoints]);

  if (loading || checkingProfile) {
    return (
        <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
            <div className="text-xl font-bold">Loading...</div>
            <div className="text-slate-400">{statusMessage}</div>
            <button 
                onClick={() => { auth.signOut(); window.location.reload(); }}
                className="px-4 py-2 bg-red-600 rounded text-sm hover:bg-red-500 mt-4"
            >
                강제 로그아웃 (멈춤 해결)
            </button>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-gray-200 flex flex-col font-sans overflow-hidden">
         <Login onLogin={setUser} />
      </div>
    );
  }

  // User logged in, but no character data => Show Character Creation
  if (!characterData) {
      return <CharacterCreation onCharacterCreated={handleCharacterCreated} />;
  }

  return (
    <div className="h-screen w-screen bg-gray-200 flex flex-col font-sans overflow-hidden">
      {/* Header Row */}
      <div className="flex w-full bg-blue-600 text-white text-xl font-bold border-b-2 border-blue-800">
        <div className="w-80 p-2 text-center border-r border-blue-500 bg-blue-700">정보창</div>
        <div className="flex-1 p-2 text-center bg-blue-600">메인화면</div>
        <div className="w-64 p-2 text-center border-l border-blue-500 bg-blue-700">인벤토리</div>
      </div>


      {/* Content Row */}
      <div className="flex-1 flex w-full overflow-hidden">
        
        {/* Left Panel: Info */}
        <div className="w-80 bg-blue-500 p-2 flex flex-col gap-2 border-r-2 border-blue-700 text-white">
          {/* Equipment Slots */}
          <div className="flex flex-col gap-2 mb-4">
            {['head', 'armor', 'leg', 'weapon'].map((slot) => {
                const equip = equipment[slot];
                const slotNames: {[key:string]: string} = { head: '머리', armor: '갑옷', leg: '각반', weapon: '무기' };
                return (
                  <div 
                    key={slot} 
                    onClick={() => handleUnequip(slot)}
                    className={`border-2 p-3 text-center rounded shadow cursor-pointer relative group
                        ${equip ? 'bg-blue-800 border-yellow-400 text-yellow-300' : 'bg-blue-600 border-blue-300 hover:bg-blue-500'}`}
                  >
                    {equip ? (
                        <>
                            <div>{equip.name}</div>
                            {equip.stats?.attack && <div className="text-xs text-red-300">공격력 +{equip.stats.attack}</div>}
                            {/* Tooltip */}
                            <div className="absolute left-full top-0 ml-2 bg-black text-white text-xs p-2 rounded hidden group-hover:block z-50 whitespace-nowrap border border-slate-500">
                                <div className="font-bold text-yellow-400">{equip.name}</div>
                                {equip.stats?.attack && <div>공격력: {equip.stats.attack}</div>}
                                <div className="text-gray-400 mt-1">클릭하여 해제</div>
                            </div>
                        </>
                    ) : (
                        slotNames[slot]
                    )}
                  </div>
                );
            })}
          </div>

          {/* Name & Stats */}
          <div className="bg-blue-600 border-2 border-blue-400 p-2 rounded mt-auto mb-2">
            <div className="text-center font-bold mb-2 border-b border-blue-400 pb-1">
              {characterData.nickname || user.displayName} (LV.{characterData.level})
            </div>
            {/* Gold Display */}
            <div className="text-yellow-300 font-bold text-center mb-1 text-sm">
                💰 {gold.toLocaleString()} G
            </div>
            {/* Stat Points */}
            <div className="bg-slate-700/80 p-2 rounded mb-3 border border-slate-600 shadow-md">
                 <div className="text-center text-blue-300 font-bold text-sm">
                     스탯 포인트 : <span className="text-white text-lg ml-1">{availablePoints}</span>
                 </div>
            </div>

            <div className="grid grid-cols-2 gap-x-1 gap-y-1 text-xs bg-slate-800/80 p-2 rounded border border-slate-700">
              {statsInfo ? (
                  <>
                    {renderStat("HP", "hp", statsInfo.total.hp)}
                    {renderStat("STR", "str", statsInfo.total.str)}
                    
                    {renderStat("MP", "mp", statsInfo.total.mp)}
                    {renderStat("INT", "int", statsInfo.total.int)}
                    
                    <div className="flex items-center justify-between my-1 px-2 py-1 bg-slate-900/40 rounded">
                        <span className="font-bold text-gray-400">ATK</span>
                        <span className="font-mono text-white mr-1">{statsInfo.total.attack}</span>
                    </div>
                    {renderStat("LUK", "luk", statsInfo.total.luk)}
                    
                    <div className="flex items-center justify-between my-1 px-2 py-1 bg-slate-900/40 rounded">
                        <span className="font-bold text-gray-400">DEF</span>
                        <span className="font-mono text-white mr-1">{statsInfo.total.defense}</span>
                    </div>
                    {renderStat("DEX", "dex", statsInfo.total.dex)}

                    <div className="col-span-2 text-[10px] text-gray-500 mt-1 text-center">
                        (HP 1pt = 100, MP 1pt = 20)
                    </div>
                    
                    {/* Apply Button */}
                    {totalAllocated > 0 ? (
                        <button 
                            onClick={applyStats}
                            className="col-span-2 mt-2 bg-blue-600 hover:bg-blue-500 text-white py-1 rounded font-bold shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wide"
                        >
                            스탯 확정 ({totalAllocated})
                        </button>
                    ) : (
                        <div className="col-span-2 h-8"></div> // Spacer
                    )}
                  </>
              ) : (
                  <div className="text-center text-slate-400 py-4">Loading Stats...</div>
              )}
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="mt-2 w-full bg-red-500 hover:bg-red-600 text-xs py-1 rounded"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Center Panel: Game View */}
        <div className="flex-1 bg-gray-800 relative flex flex-col">
          {/* Canvas Container */}
          <div className="flex-1 bg-slate-700 relative overflow-hidden" id="game-container">
            {/* Pass character data and UID to GameCanvas */}
            <GameCanvas 
                initialData={characterData} 
                uid={user.uid} 
                onStatsUpdate={handleStatsUpdate}
                onSystemLog={handleAddLog}
                onInventoryAdd={handleInventoryAdd}
                inventoryCount={inventory.length}
                inventory={inventory}
                commandTrigger={commandTrigger}
                statsSyncTrigger={statsSyncTrigger}
                playerStats={characterData.stats ? calculatePlayerStatsWithEquipment(characterData.stats, equipment) : null} 
                onExpGain={handleExpGain}
                currentHp={currentHp}
            />
          </div>

          {/* Potion Slot UI */}
          <div className="absolute bottom-72 left-2 z-50 flex items-end gap-2">
              <div className="relative group">
                  {/* Settings Toggle */}
                  <button 
                      onClick={() => setShowPotionSettings(!showPotionSettings)}
                      className="absolute -top-3 -left-3 w-5 h-5 bg-slate-700 rounded-full border border-slate-500 text-[10px] text-white flex items-center justify-center hover:bg-slate-600 z-50 shadow"
                  >
                      ⚙️
                  </button>

                  {/* Settings Panel */}
                  {showPotionSettings && (
                      <div className="absolute bottom-full left-0 mb-2 bg-slate-800 p-2 rounded border border-slate-600 w-48 shadow-lg z-50 select-none">
                          <div className="flex items-center justify-between text-xs text-white mb-1">
                              <span>자동 사용</span>
                              <input 
                                  type="checkbox" 
                                  checked={autoPotionSettings.enabled}
                                  onChange={(e) => setAutoPotionSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                              />
                          </div>
                          <div className="text-xs text-slate-300 mb-1">기준: {autoPotionSettings.threshold}%</div>
                          <input 
                              type="range" 
                              min="1" 
                              max="100" 
                              value={autoPotionSettings.threshold}
                              onChange={(e) => setAutoPotionSettings(prev => ({ ...prev, threshold: parseInt(e.target.value) }))}
                              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                  )}

                  {/* Slot Box */}
                  <div 
                      className="w-12 h-12 bg-slate-800 border-2 border-slate-600 rounded shadow-lg relative cursor-pointer overflow-hidden"
                      onClick={() => {
                          if (equippedPotionId) usePotion();
                      }}
                  >
                      {equippedPotionId ? (
                          <>
                              {/* Icon */}
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-center p-0.5 text-white font-bold leading-none select-none break-all">
                                  {inventory.find(i => i.itemId === equippedPotionId)?.name || '포션'}
                              </div>
                              {/* Amount */}
                              <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
                                  {inventory.find(i => i.itemId === equippedPotionId)?.amount || 0}
                              </div>
                              {/* Cooldown Overlay */}
                              {cooldownProgress > 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                                      <div className="text-white font-bold text-sm drop-shadow-md z-20">
                                          {Math.ceil((potionCooldownEnd - Date.now()) / 1000)}
                                      </div>
                                      <div 
                                          className="absolute inset-0"
                                          style={{
                                              background: `conic-gradient(rgba(0,0,0,0.8) ${cooldownProgress}%, transparent 0)`
                                          }}
                                      />
                                  </div>
                              )}
                          </>
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">
                              빈 슬롯
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Log/Chat Window */}
          <div className="h-48 bg-blue-800 border-t-4 border-blue-900 relative">
            {/* EXP Bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-black z-20">
                <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${((characterData.exp || 0) / ((characterData.level || 1) * 100)) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white">
                    EXP {characterData.exp || 0} / {(characterData.level || 1) * 100} (Lv.{characterData.level})
                </div>
            </div>
            
            <div className="mt-2 h-full">
            <ChatBox 
                nickname={characterData.nickname || 'Unknown'} 
                hp={currentHp}
                maxHp={statsInfo?.total.hp || 500}
                mp={currentMp}
                maxMp={statsInfo?.total.mp || 300}
                localSystemLogs={localSystemLogs}
                onCommand={(cmd) => setCommandTrigger({ cmd, id: Date.now() })}
            />
            </div>
          </div>
        </div>

        {/* Right Panel: Inventory */}
        <div className="w-64 bg-blue-500 p-2 border-l-2 border-blue-700 overflow-y-auto flex flex-col">
          {/* Auto Disassemble Settings */}
          <div className="mb-2 bg-blue-600 p-2 rounded border border-blue-400">
            <div className="text-xs font-bold text-white mb-1">자동분해 설정</div>
            <label className="flex items-center gap-1 text-xs text-white cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoDisassembleSettings.enabled}
                onChange={(e) => setAutoDisassembleSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-3 h-3"
              />
              <span>자동분해 활성화</span>
            </label>
            {autoDisassembleSettings.enabled && (
              <div className="mt-1 flex flex-wrap gap-1">
                {['common', 'rare', 'epic', 'heroic', 'legendary'].map(grade => (
                  <label key={grade} className="flex items-center gap-1 text-[10px] text-white cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={autoDisassembleSettings.grades.includes(grade)}
                      onChange={(e) => {
                        setAutoDisassembleSettings(prev => ({
                          ...prev,
                          grades: e.target.checked 
                            ? [...prev.grades, grade]
                            : prev.grades.filter(g => g !== grade)
                        }));
                      }}
                      className="w-2 h-2"
                    />
                    <span>{GRADE_NAMES[grade as keyof typeof GRADE_NAMES]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Grid */}
          <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto">
            {Array.from({ length: 24 }).map((_, i) => {
              const item = inventory[i];
              const isSelected = selectedItems.has(i);
              return (
                <div 
                    key={i} 
                    onContextMenu={(e) => item ? handlePotionEquip(e, item) : e.preventDefault()}
                    onClick={() => {
                      if (disassembleMode) {
                        toggleItemSelection(i);
                      } else if (item) {
                        handleEquip(i);
                      }
                    }}
                    className={`aspect-square bg-blue-600 border rounded hover:bg-blue-400 cursor-pointer flex items-center justify-center text-xs text-white relative group
                        ${disassembleMode ? 'border-yellow-400' : 'border-blue-400'}
                        ${isSelected ? 'ring-2 ring-yellow-400' : ''}
                    `}
                >
                    {item ? (
                        <>
                            {/* Checkbox (when in disassemble mode) */}
                            {disassembleMode && (
                                <div className="absolute top-0 left-0 w-4 h-4 bg-yellow-400 border border-yellow-600 rounded flex items-center justify-center">
                                    {isSelected && <span className="text-[10px] text-black font-bold">✓</span>}
                                </div>
                            )}
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-black text-white text-xs p-1 rounded hidden group-hover:block z-50 whitespace-nowrap border border-slate-500">
                                <div className="font-bold mb-1">{item.name} {item.amount > 1 && `x${item.amount}`}</div>
                                {item.type === 'equipment' && (
                                    <>
                                        {item.grade && (
                                            <div className="text-[10px] mb-1">
                                                등급: {GRADE_NAMES[item.grade as keyof typeof GRADE_NAMES]}
                                            </div>
                                        )}
                                        <div className="text-yellow-300">
                                            {item.subType === 'weapon' && `공격력 +${item.stats?.attack || 0}`}
                                            {item.subType === 'armor' && `방어력 +${item.stats?.defense || 0}`}
                                            <div className="text-[10px] text-gray-400 mt-1">
                                                {disassembleMode ? '클릭하여 선택' : '클릭하여 장착'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <span>{item.name.slice(0, 2)}..</span>
                            {item.amount > 1 && (
                                <span className="absolute bottom-0 right-0 text-[10px] bg-black/50 px-1 rounded">{item.amount}</span>
                            )}
                        </>
                    ) : null}
                </div>
              );
            })}
          </div>

          {/* Disassemble Buttons */}
          <div className="mt-2 flex flex-col gap-1">
            {!disassembleMode ? (
              <button
                onClick={() => {
                  setDisassembleMode(true);
                  setSelectedItems(new Set());
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-xs py-1 rounded font-bold"
              >
                선택분해
              </button>
            ) : (
              <>
                <button
                  onClick={handleDisassembleSelected}
                  disabled={selectedItems.size === 0}
                  className={`w-full text-xs py-1 rounded font-bold ${
                    selectedItems.size > 0
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  분해 ({selectedItems.size})
                </button>
                <button
                  onClick={() => {
                    setDisassembleMode(false);
                    setSelectedItems(new Set());
                  }}
                  className="w-full bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 rounded"
                  >
                  취소
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
