import React, { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

  // Types for our game entities
  interface Entity {
    id: string;
    x: number;
    y: number;
    targetX?: number;
    targetY?: number;
    type: string; // 'archer' | 'mage' | 'sword' | 'shield' | 'skeleton'
    variant?: string; // 'blue' | 'red' ...
    state: 'idle' | 'walk' | 'attack' | 'dead';
    direction: 'left' | 'right';
    frame: number;
    lastFrameTime: number;
    speed: number;
    nickname?: string;
    name?: string; // Monster name from server
    hp?: number;
    maxHp?: number;
    attackRange?: number;
    lastAttackTime?: number; // Added for client-side cooldown check
  }

// Dropped Item Entity
interface DroppedItem {
    id: string; // Unique drop ID
    x: number;
    y: number;
    itemId: string; // DB ID (e.g. potion_hp_small)
    name: string;
    color: string;
    ownerId?: string; // Owner for priority looting
    dropTime: number; // When it was dropped
    type?: string;
    amount?: number;
}

const FRAME_DURATION = 100; // ms per frame

interface GameCanvasProps {
  initialData?: any; 
  uid: string; // Used as a visual ID, but socket ID will be the real network ID
  onStatsUpdate?: (hp: number, mp: number) => void;
  onSystemLog?: (text: string) => void;
  onInventoryAdd?: (item: { itemId: string, name: string, type?: string, amount?: number }) => void;
  inventoryCount?: number;
  inventory?: any[]; // Need inventory content for stack check
  commandTrigger?: { cmd: string, id: number } | null;
  playerStats?: any; // Calculated stats from App
  onExpGain?: (amount: number) => void;
  statsSyncTrigger?: { stats: any, id: number } | null; // Manual trigger for stats sync
  currentHp?: number; // Current HP from App (for level-up HP recovery sync)
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ initialData, onStatsUpdate, onSystemLog, onInventoryAdd, inventoryCount = 0, inventory = [], commandTrigger, playerStats, onExpGain, statsSyncTrigger, currentHp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  
  // Keep latest stats in ref for socket callbacks
  const playerStatsRef = useRef(playerStats);
  useEffect(() => {
      playerStatsRef.current = playerStats;
  }, [playerStats]);

  // Game State
  const playerRef = useRef<Entity | null>(null);
  const otherPlayersRef = useRef<Map<string, Entity>>(new Map());
  const monstersRef = useRef<Map<string, Entity>>(new Map());
  const itemsRef = useRef<Map<string, DroppedItem>>(new Map()); // Track items

  // Inventory Tracker
  const localInventoryCount = useRef(inventoryCount);
  const localInventory = useRef(inventory); // Track content

  useEffect(() => {
      localInventoryCount.current = inventoryCount;
      localInventory.current = inventory;
  }, [inventoryCount, inventory]);

  // Handle Command Trigger
  useEffect(() => {
      if (commandTrigger && socketRef.current) {
          socketRef.current.emit('adminCommand', commandTrigger.cmd);
      }
  }, [commandTrigger]);

  // Sync Stats to Server (ONLY when explicitly triggered)
  useEffect(() => {
      if (statsSyncTrigger && socketRef.current && isConnected && statsSyncTrigger.stats) {
          socketRef.current.emit('updateStats', statsSyncTrigger.stats);
          console.log('[Client] Stats synced to server (manual):', statsSyncTrigger.stats);
      }
  }, [statsSyncTrigger, isConnected]);

  // Sync HP to Server when currentHp changes (for level-up HP recovery)
  const prevHpRef = React.useRef<number | undefined>(currentHp);
  useEffect(() => {
      if (currentHp !== undefined && currentHp !== prevHpRef.current && socketRef.current && isConnected && playerRef.current) {
          // Only sync if HP increased (level-up recovery) or if explicitly forced
          if (currentHp > (prevHpRef.current || 0)) {
              // For level-up recovery, force update even if server HP is higher
              socketRef.current.emit('updateHp', { hp: currentHp, force: true });
              // Update local player ref
              playerRef.current.hp = currentHp;
          }
          prevHpRef.current = currentHp;
      }
  }, [currentHp, isConnected]);

  const [isDead, setIsDead] = React.useState(false);

  // ========================================
  // SPRITE LOADING - PLACEHOLDER IMPLEMENTATION
  // ========================================
  // TODO: Add your own character/monster sprites
  // 
  // To use sprite images:
  // 1. Place sprite images in /public/sprites/ folder
  // 2. Organize by: /sprites/{type}/{variant}/{state}_{frame}.png
  //    Example: /sprites/ske_sword/sword_blue/walk_1.png
  // 3. Uncomment the loadImages function below
  // 4. Update drawEntity function to use sprites instead of boxes
  //
  // Current Implementation: Renders colored boxes as placeholders
  
  const loadImages = async () => {
    // PLACEHOLDER: No sprites to load
    // Uncomment below to load actual sprite images
    
    /*
    // Load Player Sprites
    const pClasses = ['ske_sword', 'ske_shield', 'ske_mage', 'ske_archer'];
    const pVariants = ['blue']; 
    const states = ['walk', 'ready', 'attack1', 'dead_near'];
    
    // Load Monster Sprites (Skeleton for now)
    const mClasses = ['ske_sword']; 
    const mVariants = ['red', 'green']; // Red (Aggro) & Green (Passive)
    
    const frames = 6; 
    const promises: Promise<boolean>[] = [];
    
    // Helper
    const addImage = (cls: string, variant: string, state: string) => {
        for (let i = 1; i <= frames; i++) {
            const vName = cls.replace('ske_', '') + '_' + variant;
            const src = `/sprites/${cls}/${vName}/${state}_${i}.png`;
            if (imagesRef.current[src]) continue;
            const img = new Image();
            img.src = src;
            promises.push(new Promise((resolve) => {
                img.onload = () => { imagesRef.current[src] = img; resolve(true); };
                img.onerror = () => { 
                    console.error(`Failed to load image: ${src}`); 
                    resolve(false); 
                }
            }));
        }
    };

    pClasses.forEach(c => pVariants.forEach(v => states.forEach(s => addImage(c, v, s))));
    mClasses.forEach(c => mVariants.forEach(v => states.forEach(s => addImage(c, v, s))));
    
    await Promise.all(promises);
    console.log("Images loaded");
    */
  };

  // --- Socket Connection ---
  useEffect(() => {
    // Connect to Game Server
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
        console.log("Connected to Game Server:", socket.id);
        setIsConnected(true);
        
        // Join Game
        socket.emit('join', {
            nickname: initialData?.nickname || 'Player',
            class: initialData?.class || 'sword',
            x: initialData?.position?.x || 400,
            y: initialData?.position?.y || 300,
            stats: playerStatsRef.current // Send calculated stats immediately
        });
    });

    // 1. Initial State
    socket.on('currentPlayers', (players: any) => {
        Object.keys(players).forEach(id => {
            if (id === socket.id) {
                // My Player
                playerRef.current = {
                    ...players[id],
                    variant: 'blue', // Force blue for players
                    type: players[id].class || 'sword',
                    frame: 1,
                    lastFrameTime: 0
                };
            } else {
                // Others
                otherPlayersRef.current.set(id, {
                    ...players[id],
                    variant: 'blue',
                    type: players[id].class || 'sword',
                    frame: 1,
                    lastFrameTime: 0
                });
            }
        });
    });

    socket.on('currentMonsters', (monsters: any) => {
        Object.keys(monsters).forEach(id => {
            // Map server monster types to client sprite types
            let clientType = monsters[id].type;
            if (clientType === 'skeleton') clientType = 'sword'; // Use sword sprite for skeleton

            monstersRef.current.set(id, {
                ...monsters[id],
                type: clientType, 
                frame: 1,
                lastFrameTime: 0,
                speed: 1.5
            });
        });
    });

    socket.on('currentItems', (items: any) => {
        Object.keys(items).forEach(id => {
            itemsRef.current.set(id, items[id]);
        });
    });

    // 2. Updates
    socket.on('newPlayer', (player: any) => {
        otherPlayersRef.current.set(player.id, {
            ...player,
            variant: 'blue',
            type: player.class || 'sword',
            frame: 1,
            lastFrameTime: 0
        });
    });

    socket.on('playerMoved', (data: any) => {
        const other = otherPlayersRef.current.get(data.id);
        if (other) {
            if (other.state !== data.state) {
                other.frame = 1; // Reset frame on state change
            }
            other.targetX = data.x; 
            other.targetY = data.y;
            other.state = data.state; 
            other.direction = data.direction;
            
            // If attack, force position update
            if (data.state === 'attack') {
                other.x = data.x;
                other.y = data.y;
            }
        } else {
             // Sync issue handling
        }
    });

    socket.on('playerDisconnected', (id: string) => {
        otherPlayersRef.current.delete(id);
    });

    socket.on('monsterUpdate', (monsters: any) => {
        Object.keys(monsters).forEach(id => {
            const data = monsters[id];
            const mob = monstersRef.current.get(id);
            if (mob) {
                mob.targetX = data.x; 
                mob.targetY = data.y;
                mob.state = data.state;
                mob.hp = data.hp; // Sync HP
                mob.maxHp = data.maxHp;
            } else {
                // Map server monster types to client sprite types
                let clientType = data.type;
                if (clientType === 'skeleton') clientType = 'sword';

                monstersRef.current.set(id, {
                    ...data,
                    type: clientType,
                    frame: 1,
                    lastFrameTime: 0,
                    speed: 1.5
                });
            }
        });
    });

    socket.on('monsterDamaged', (data: any) => {
        const mob = monstersRef.current.get(data.monsterId);
        if (mob) {
            mob.hp = data.hp;
            // Log to System Tab (Local Only) if I am the attacker
            if (data.attackerId === socket.id && onSystemLog) {
                 onSystemLog(`몬스터에게 ${data.damage} 데미지를 입혔습니다.`);
            }
        }
    });

    socket.on('playerDamaged', (data: any) => {
        if (data.playerId === socket.id) {
             // Update local player ref HP
             if (playerRef.current) {
                 // Only update if server HP is not stale (damage > 0 means real damage, damage === 0 means sync)
                 // For sync (damage === 0), always accept
                 // For real damage, accept if it's reasonable
                 const shouldUpdate = data.damage === 0 || // Sync from server
                                     (playerRef.current.hp === undefined) || // Initial state
                                     (data.hp <= playerRef.current.hp); // Real damage (HP decreased)
                 
                 if (shouldUpdate) {
                     playerRef.current.hp = data.hp;
                     // Update UI
                     if (onStatsUpdate) {
                         onStatsUpdate(data.hp, 300);
                     }
                 }

                 // "You took damage" - Local Log (only for real damage)
                 if (data.damage > 0 && onSystemLog) {
                     onSystemLog(`몬스터에게 ${data.damage} 피해를 입었습니다! (HP: ${data.hp})`);
                 }
             }
        }
    });

    socket.on('monsterDead', (data: any) => {
        monstersRef.current.delete(data.monsterId);
        if (data.killerId === socket.id) {
            if (onSystemLog) onSystemLog(`몬스터를 처치했습니다!`);
        }
    });

    socket.on('playerDead', (data: any) => {
        if (data.playerId === socket.id) {
            setIsDead(true);
            if (playerRef.current) playerRef.current.state = 'dead';
            if (onSystemLog) onSystemLog("사망했습니다.");
        } else {
             const p = otherPlayersRef.current.get(data.playerId);
             if (p) p.state = 'dead';
        }
    });

    socket.on('playerRespawn', (data: any) => {
        if (data.id === socket.id) {
            setIsDead(false);
            if (playerRef.current) {
                playerRef.current.state = 'idle';
                playerRef.current.hp = data.hp;
                playerRef.current.x = data.x;
                playerRef.current.y = data.y;
            }
            if (onStatsUpdate) onStatsUpdate(data.hp, 300);
            if (onSystemLog) onSystemLog("부활했습니다.");
        } else {
            const p = otherPlayersRef.current.get(data.id);
            if (p) {
                p.state = 'idle';
                p.hp = data.hp;
                p.x = data.x;
                p.y = data.y;
            }
        }
    });

    socket.on('itemDropped', (item: DroppedItem) => {
        itemsRef.current.set(item.id, item);
    });

    socket.on('itemPicked', (data: { itemId: string, playerId: string }) => {
        itemsRef.current.delete(data.itemId);
    });

    socket.on('itemsCleared', () => {
        itemsRef.current.clear();
        if (onSystemLog) onSystemLog("모든 아이템이 삭제되었습니다.");
    });

    socket.on('itemExpired', (data: { itemId: string }) => {
        itemsRef.current.delete(data.itemId);
        if (onSystemLog) onSystemLog("아이템이 사라졌습니다.");
    });

    socket.on('inventoryAdd', (item: { itemId: string, name: string, type?: string, amount?: number }) => {
        if (onInventoryAdd) {
            onInventoryAdd(item);
        }
    });

    // Handle Auto-Loot from Server
    socket.on('autoLoot', (item: DroppedItem) => {
        if (item.type === 'exp') {
             // Handle EXP gain immediately
             if (onExpGain && item.amount) onExpGain(item.amount);
             if (onSystemLog) onSystemLog(`경험치를 획득했습니다. (+${item.amount} EXP)`);
        } else if (item.type === 'gold') {
             // Gold doesn't take inventory space
             if (onInventoryAdd) onInventoryAdd(item);
        } else {
             // Check if stackable and exists
             const isStackable = item.type === 'potion' || item.type === 'material';
             const exists = localInventory.current.some((i: any) => i.itemId === item.itemId);

             if (isStackable && exists) {
                 // Just add amount, no space needed
                 if (onInventoryAdd) onInventoryAdd(item);
             } else {
                 // New slot needed
                 if (localInventoryCount.current < 24) {
                     if (onInventoryAdd) onInventoryAdd(item);
                     localInventoryCount.current++; // Increment local count
                 } else {
                     // Inventory Full -> Drop Item
                     socket.emit('itemDropRequest', item);
                     if (onSystemLog) onSystemLog("인벤토리가 가득 차 아이템을 떨어뜨렸습니다.");
                 }
             }
        }
    });

    return () => {
        socket.disconnect();
    };
  }, []);

  // --- Game Loop ---
  const update = (time: number) => {
    const player = playerRef.current;
    
    // 1. Local Player Auto-Targeting & Auto-Pickup
    if (player) {
        // Stop control if dead
        if (player.state === 'dead') {
             // Just render, no logic
        } else {
            let nearestMonsterDist = Infinity;
            let targetMonster: Entity | null = null;

            monstersRef.current.forEach(m => {
                const dist = Math.sqrt(Math.pow(m.x - player.x, 2) + Math.pow(m.y - player.y, 2));
                if (dist < nearestMonsterDist) {
                    nearestMonsterDist = dist;
                    targetMonster = m;
                }
            });

            const attackRange = player.attackRange || 60;
            if (targetMonster && nearestMonsterDist < 400) { // Detection range
                if (nearestMonsterDist > attackRange) {
                    // Move towards target
                    const dx = (targetMonster as Entity).x - player.x;
                    const dy = (targetMonster as Entity).y - player.y;
                    player.x += (dx / nearestMonsterDist) * player.speed;
                    player.y += (dy / nearestMonsterDist) * player.speed;
                    player.state = 'walk';
                    
                    if (dx > 0) player.direction = 'right';
                    else player.direction = 'left';
                    
                    // Auto-pickup for owner (Legacy support for ground items)
                    itemsRef.current.forEach(item => {
                        const itemDist = Math.sqrt(Math.pow(item.x - player.x, 2) + Math.pow(item.y - player.y, 2));
                        if (itemDist < 40 && item.ownerId === socketRef.current?.id) { 
                            socketRef.current?.emit('pickupItem', item.id);
                        }
                    });

                    // Sync Move
                    socketRef.current?.emit('move', {
                        x: player.x, y: player.y, 
                        state: 'walk', direction: player.direction
                    });
                } else {
                    // Attack
                    
                    // Client-side Attack Cooldown (Throttle) - 1.5s
                    const now = Date.now();
                    if (now - (player.lastAttackTime || 0) > 1500) {
                        player.state = 'attack';
                        player.lastAttackTime = now;
                        socketRef.current?.emit('attack', (targetMonster as Entity).id);
                    } else {
                         // Waiting for cooldown, stay idle or keep facing target
                         if (player.state !== 'attack') player.state = 'idle';
                    }
                }
            } else {
                player.state = 'idle';
                // Sync Idle
                if (Math.random() < 0.02) { // Sync occasionally to keep state correct
                    socketRef.current?.emit('move', {
                        x: player.x, y: player.y, 
                        state: 'idle', direction: player.direction
                    });
                }
            }
        }
    }
    
    // 2. Animation & Interpolation
    const animateAndMove = (entity: Entity, isRemote: boolean) => {
        // Movement Interpolation
        if (isRemote && entity.targetX !== undefined && entity.targetY !== undefined) {
            const dx = entity.targetX - entity.x;
            const dy = entity.targetY - entity.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Lower threshold for movement to prevent early idle snapping
            if (dist > 0.5) { 
                const lerp = 0.1;
                entity.x += dx * lerp;
                entity.y += dy * lerp;
                
                if (dx > 0) entity.direction = 'right';
                else entity.direction = 'left';
                
                // Only override state if server isn't dictating a specific action like attack/dead
                if (entity.state !== 'attack' && entity.state !== 'dead') {
                    if (entity.state !== 'walk') {
                         entity.state = 'walk';
                         entity.frame = 1; // Reset frame when starting to walk
                    }
                }
            } else {
                // Arrived
                if (entity.state === 'walk') {
                    entity.state = 'idle'; 
                    entity.frame = 1; // Reset frame when stopping
                }
                // Force snap to target
                entity.x = entity.targetX;
                entity.y = entity.targetY;
            }
        }

        // Animation Frame Logic
        let maxFrames = 6;
        if (entity.state === 'idle') maxFrames = 3; 
        // Fix for Mage Attack (likely 4 frames causing blue box on 5,6)
        if (entity.type === 'mage' && entity.state === 'attack') maxFrames = 4;
        
        // Safety: If current frame is out of bounds for new state, clamp it immediately
        if (entity.frame > maxFrames) entity.frame = 1;

        if (time - entity.lastFrameTime > FRAME_DURATION) {
            // One-Shot Death Animation
            if (entity.state === 'dead') {
                 if (entity.frame < maxFrames) {
                     entity.frame++;
                 }
            } else {
                entity.frame = (entity.frame % maxFrames) + 1; 
            }
            entity.lastFrameTime = time;
        }
    };

    if (playerRef.current) animateAndMove(playerRef.current, false);
    otherPlayersRef.current.forEach(p => animateAndMove(p, true));
    monstersRef.current.forEach(m => animateAndMove(m, true));
  };

  // ========================================
  // ENTITY RENDERING - BOX PLACEHOLDER
  // ========================================
  // TODO: Update this function to draw sprites once you add sprite images
  // Current Implementation: Renders colored boxes with labels
  
  const drawEntity = (ctx: CanvasRenderingContext2D, entity: Entity, isLocal: boolean, isMonster: boolean) => {
    // ===== PLACEHOLDER BOX RENDERING =====
    // Character Types -> Box Colors
    const playerColors: Record<string, string> = {
      'sword': '#4A90E2',    // Blue - Warrior
      'shield': '#7ED321',   // Green - Tank
      'mage': '#BD10E0',     // Purple - Mage
      'archer': '#F5A623'    // Orange - Archer
    };
    
    const monsterColors: Record<string, string> = {
      'red': '#E74C3C',      // Red - Aggressive
      'green': '#27AE60'     // Green - Passive
    };
    
    // Determine box size and color
    const boxSize = isMonster ? 30 : 35;
    const halfSize = boxSize / 2;
    
    let boxColor: string;
    if (isMonster) {
      boxColor = monsterColors[entity.variant || 'red'] || '#E74C3C';
    } else {
      boxColor = playerColors[entity.type] || '#4A90E2';
      if (isLocal) boxColor = '#FFD700'; // Gold for local player
    }
    
    // Draw state indicator (border)
    let borderColor = 'white';
    let borderWidth = 2;
    if (entity.state === 'attack') {
      borderColor = '#FF0000';
      borderWidth = 3;
    } else if (entity.state === 'dead') {
      borderColor = '#555555';
      boxColor = '#333333';
    }
    
    // Draw box
    ctx.save();
    ctx.translate(entity.x, entity.y);
    
    // Flip if facing left (visual indicator)
    if (entity.direction === 'left') {
      ctx.scale(-1, 1);
    }
    
    // Border
    ctx.fillStyle = borderColor;
    ctx.fillRect(-halfSize - borderWidth, -halfSize - borderWidth, 
                 boxSize + borderWidth * 2, boxSize + borderWidth * 2);
    
    // Main box
    ctx.fillStyle = boxColor;
    ctx.fillRect(-halfSize, -halfSize, boxSize, boxSize);
    
    // Draw type indicator (first letter)
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const typeLabel = isMonster ? 'M' : entity.type.charAt(0).toUpperCase();
    ctx.fillText(typeLabel, 0, 0);
    
    ctx.restore();

    // Draw Name / HP Bar
    ctx.save();
    ctx.translate(entity.x, entity.y);
    
    if (isMonster) {
      // Monster HP Bar
      const hpBarY = -halfSize - 10;
      ctx.fillStyle = '#444444';
      ctx.fillRect(-20, hpBarY, 40, 5);
      ctx.fillStyle = '#E74C3C';
      ctx.fillRect(-20, hpBarY, 40, 5);
      ctx.fillStyle = '#2ECC71';
      ctx.fillRect(-20, hpBarY, 40 * ((entity.hp || 100) / (entity.maxHp || 100)), 5);
      
      // Monster Name
      ctx.fillStyle = '#E74C3C'; 
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 3;
      ctx.fillText(entity.name || 'Monster', 0, hpBarY - 3);
    } else {
      // Player Name
      const nameY = -halfSize - 10;
      ctx.fillStyle = isLocal ? '#FFD700' : 'white'; 
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(entity.nickname || 'Unknown', 0, nameY);
    }
    
    ctx.restore();
    
    // ===== TO USE SPRITES: Uncomment and modify below =====
    /*
    const typeName = entity.type; 
    const folderType = `ske_${typeName}`;
    const folderVariant = `${typeName}_${entity.variant || 'green'}`;
    
    let stateName = 'ready';
    if (entity.state === 'walk') stateName = 'walk';
    if (entity.state === 'attack') stateName = 'attack1';
    if (entity.state === 'dead') stateName = 'dead_near';
    if (entity.state === 'idle') stateName = 'ready';
    
    let maxFrames = 6;
    if (entity.state === 'idle') maxFrames = 3;
    const safeFrame = (entity.frame > maxFrames) ? 1 : entity.frame;
    
    const src = `/sprites/${folderType}/${folderVariant}/${stateName}_${safeFrame}.png`;
    const img = imagesRef.current[src];

    if (img) {
        ctx.save();
        ctx.translate(entity.x, entity.y);
        
        const scale = 1; 
        if (entity.direction === 'left') {
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(img, -img.width/2 * scale, -img.height/2 * scale, img.width * scale, img.height * scale);
        ctx.restore();

        // Draw Name / HP Bar
        ctx.save();
        ctx.translate(entity.x, entity.y);
        
        if (isMonster) {
            ctx.fillStyle = 'red';
            ctx.fillRect(-20, -img.height/2 - 10, 40, 5);
            ctx.fillStyle = 'lime';
            ctx.fillRect(-20, -img.height/2 - 10, 40 * ((entity.hp || 100) / (entity.maxHp || 100)), 5);
            
            ctx.fillStyle = 'red';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(entity.name || 'Monster', 0, -img.height/2 - 15);
        } else {
            ctx.fillStyle = isLocal ? '#ffff00' : 'white'; 
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(entity.nickname || 'Unknown', 0, -img.height/2 - 10);
        }
        
        ctx.restore();
    }
    */
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Background
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw Monsters
    monstersRef.current.forEach(m => drawEntity(ctx, m, false, true));

    // Draw Items
    itemsRef.current.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        
        // Simple Item Graphic (Circle with color)
        ctx.fillStyle = item.color || 'yellow';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Item Name (Optional, small text)
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, 0, -12);
        
        ctx.restore();
    });

    // Draw Other Players
    otherPlayersRef.current.forEach(p => drawEntity(ctx, p, false, false));

    // Draw Local Player
    if (playerRef.current) {
        drawEntity(ctx, playerRef.current, true, false);
    }
  };

  const loop = (time: number) => {
    update(time);
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) draw(ctx);
    }
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    loadImages().then(() => {
        requestRef.current = requestAnimationFrame(loop);
    });
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'f' || e.key === 'F') {
            if (playerRef.current && !isDead) {
                // Try to pickup non-owned expired items
                itemsRef.current.forEach(item => {
                    const dist = Math.sqrt(Math.pow(item.x - playerRef.current!.x, 2) + Math.pow(item.y - playerRef.current!.y, 2));
                    if (dist < 60) { // Increased F-key pickup range
                        // Attempt pickup (Server will validate time/ownership)
                        socketRef.current?.emit('pickupItem', item.id); 
                    }
                });
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDead]);

  const handleRespawn = () => {
      socketRef.current?.emit('respawn');
  };

  return (
    <div className="relative w-full h-full">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="w-full h-full object-contain bg-slate-800"
        />
        {isDead && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-50">
                <h2 className="text-3xl font-bold text-red-500 mb-4">YOU DIED</h2>
                <button 
                    onClick={handleRespawn}
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded font-bold shadow-lg transition transform hover:scale-105"
                >
                    부활하기
                </button>
            </div>
        )}
    </div>
  );
};
