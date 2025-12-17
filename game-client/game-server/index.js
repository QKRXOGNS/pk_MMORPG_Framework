const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { db } = require('./firebase');
const { doc, getDoc, getDocs, collection } = require("firebase/firestore");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// --- Constants & Config (Initial Defaults) ---
const MONSTER_COUNT = 5; // 5 groups of 3 = 15 monsters
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;

// --- Game State ---
const players = {};
const monsters = {};
let items = {}; // Changed to let to allow clearing

// --- Data Cache ---
// We will load these from Firestore
let GAME_DATA = {
    monsterStats: {}, // key: type (e.g. 'skeleton_weak') -> stat object
    items: [],        // list of all base items
    config: {         // default config
        dropRates: {
            globalGoldChance: 0.7,
            globalMaterialChance: 0.3,
            globalEquipmentChance: 0.05
        },
        gradeConfig: {
             chances: { common: 0.60, rare: 0.25, epic: 0.10, heroic: 0.04, legendary: 0.01 },
             multipliers: { common: 1.0, rare: 1.5, epic: 2.5, heroic: 4.0, legendary: 6.0 },
             colors: { common: "#A0A0A0", rare: "#4169E1", epic: "#9370DB", heroic: "#FFD700", legendary: "#FF4500" }
        }
    }
};

// --- Helper: Random ID ---
const uuid = () => Math.random().toString(36).substr(2, 9);

// --- Load Game Data Function ---
async function loadGameData() {
    console.log("Loading Game Data from Firestore...");
    try {
        // 1. Load Monster Definitions
        const monstersSnap = await getDocs(collection(db, "monsters"));
        monstersSnap.forEach(doc => {
            GAME_DATA.monsterStats[doc.id] = doc.data();
        });

        // 2. Load Item Definitions
        const itemsSnap = await getDocs(collection(db, "items"));
        const itemsList = [];
        itemsSnap.forEach(doc => {
            itemsList.push(doc.data());
        });
        GAME_DATA.items = itemsList;

        // 3. Load Server Config
        const configSnap = await getDoc(doc(db, "serverConfig", "main"));
        if (configSnap.exists()) {
            GAME_DATA.config = configSnap.data();
        }

        console.log(`Game Data Loaded: ${Object.keys(GAME_DATA.monsterStats).length} monsters, ${GAME_DATA.items.length} items.`);
    } catch (err) {
        console.error("Error loading game data:", err);
    }
}

// --- Helper: Generate Equipment ---
const generateEquipment = (targetGrade, levelBias = 1) => {
    // Filter equipment items only
    const equipmentPool = GAME_DATA.items.filter(i => i.type === 'equipment');
    if (equipmentPool.length === 0) return null;

    // Pick a random item (can be weighted by level later)
    // For now, simple random
    const baseItem = equipmentPool[Math.floor(Math.random() * equipmentPool.length)];
    
    // Determine Grade Logic
    const gradeConfig = GAME_DATA.config.gradeConfig;
    const grade = targetGrade || 'common'; // Use provided grade or fallback
    const multiplier = gradeConfig.multipliers[grade] || 1;
    const color = gradeConfig.colors[grade] || "#A0A0A0";
    
    // Name formatting (e.g. [Rare] Iron Sword) - User wanted prefixes?
    // Let's use simple Grade Name mapping
    const gradeNames = { common: '일반', rare: '희귀', epic: '서사', heroic: '영웅', legendary: '전설' };
    const gradeName = gradeNames[grade] || '';
    const namePrefix = grade === 'common' ? '낡은 ' : `${gradeName}의 `;

    // Clone stats and apply multiplier
    const stats = {};
    if (baseItem.baseStats) {
        Object.keys(baseItem.baseStats).forEach(k => {
             const baseVal = baseItem.baseStats[k];
             // Apply multiplier + Variance
             const scaledVal = baseVal * multiplier;
             const variance = Math.max(1, Math.floor(scaledVal * 0.1));
             stats[k] = Math.max(1, Math.floor(scaledVal + (Math.random() * variance * 2) - variance));
        });
    }

    return {
        itemId: `${baseItem.id}_${grade}_${uuid()}`,
        name: `${namePrefix}${baseItem.name}`,
        color: color,
        type: "equipment",
        subType: baseItem.subType,
        stats: stats,
        grade: grade,
        levelRequirement: baseItem.levelReq || 1,
        amount: 1
    };
};

// --- Init Monsters ---
const spawnMonsterGroup = () => {
    const centerX = Math.random() * (MAP_WIDTH - 100) + 50;
    const centerY = Math.random() * (MAP_HEIGHT - 100) + 50;
    
    // We have 2 types: skeleton_weak (green/passive) and skeleton_warrior (red/aggressive)
    // We'll spawn 1 Warrior and 2 Weak per group to match the 1:2 ratio
    
    const definitions = [
        GAME_DATA.monsterStats['skeleton_warrior'] || GAME_DATA.monsterStats['skeleton_weak'], // Leader
        GAME_DATA.monsterStats['skeleton_weak'], // Follower 1
        GAME_DATA.monsterStats['skeleton_weak']  // Follower 2
    ];

    definitions.forEach(def => {
        if (!def) return; // Skip if data missing

        const id = uuid();
        monsters[id] = {
            id: id,
            x: centerX + (Math.random() * 60 - 30),
            y: centerY + (Math.random() * 60 - 30),
            // Base stats from DB
            hp: def.hp,
            maxHp: def.maxHp,
            attack: def.attack,
            defense: def.defense,
            exp: def.exp,
            speed: def.speed,
            // Logic properties
            name: def.name, // Copy name from DB definition
            type: def.type,
            variant: def.variant, // 'red' or 'green'
            state: 'idle',
            targetId: null,
            lastHitTime: 0,
            aggroRange: def.aggroRange,
            isAggressive: def.aggroRange > 0,
            attackRange: def.attackRange,
            damage: def.attack, // Use attack as damage
            dropTable: def.dropTable // Carry over drop table
        };
    });
};

// --- Start Server ---
loadGameData().then(() => {
    // Spawn Initial Monsters
    for (let i = 0; i < MONSTER_COUNT; i++) spawnMonsterGroup();

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);

      // 1. Handle Join
      socket.on('join', (userData) => {
        let attackRange = 60; 
        if (userData.class === 'mage' || userData.class === 'archer') {
            attackRange = 180; 
        }

        players[socket.id] = {
          id: socket.id,
          ...userData,
          x: userData.x || 400,
          y: userData.y || 300,
          state: 'idle',
          direction: 'right',
          speed: 3,
          score: 0,
          hp: userData.playerStats?.hp || 500,
          maxHp: userData.playerStats?.hp || 500,
          mp: userData.playerStats?.mp || 300,
          maxMp: userData.playerStats?.mp || 300,
          attackRange: attackRange,
          stats: userData.playerStats,
          class: userData.class,
          lastAttackTime: 0 
        };
        
        socket.emit('currentPlayers', players);
        socket.emit('currentMonsters', monsters);
        socket.emit('currentItems', items);
        socket.broadcast.emit('newPlayer', players[socket.id]);
      });

      // 2. Handle Movement
      socket.on('move', (movementData) => {
        const player = players[socket.id];
        if (player) {
          player.x = movementData.x;
          player.y = movementData.y;
          player.state = movementData.state;
          player.direction = movementData.direction;
          player.targetX = movementData.targetX;
          player.targetY = movementData.targetY;

          socket.broadcast.emit('playerMoved', { 
            id: socket.id, 
            ...movementData 
          });
        }
      });

      // 3. Handle Stats Update
      socket.on('updateStats', (stats) => {
          const player = players[socket.id];
          if (player) {
              player.stats = stats;
              // Update max HP/MP
              if (stats.hp) {
                  const oldMaxHp = player.maxHp || 500;
                  player.maxHp = stats.hp;
                  if (player.hp >= oldMaxHp) {
                      player.hp = stats.hp;
                  } else {
                      const hpPercent = player.hp / oldMaxHp;
                      player.hp = Math.min(Math.floor(stats.hp * hpPercent), stats.hp);
                  }
              }
              if (stats.mp) {
                  const oldMaxMp = player.maxMp || 300;
                  player.maxMp = stats.mp;
                  if (player.mp >= oldMaxMp) {
                      player.mp = stats.mp;
                  } else {
                      const mpPercent = player.mp / oldMaxMp;
                      player.mp = Math.min(Math.floor(stats.mp * mpPercent), stats.mp);
                  }
              }
          }
      });

      // 4. Handle HP Update (Level Up / Potion)
      socket.on('updateHp', (data) => {
          const player = players[socket.id];
          if (player && data.hp !== undefined) {
              if (data.force || data.hp > player.hp) {
                  const newHp = Math.min(data.hp, player.maxHp || 500);
                  player.hp = newHp;
                  
                  // Sync back
                  socket.emit('playerDamaged', {
                      playerId: socket.id,
                      damage: 0, 
                      hp: newHp
                  });
              }
          }
      });

      // 5. Handle Attack
      socket.on('attack', (monsterId) => {
          const monster = monsters[monsterId];
          const player = players[socket.id];
          
          if (monster && player) {
              const now = Date.now();
              if (now - (player.lastAttackTime || 0) < 1500) return;
              player.lastAttackTime = now;

              const dx = monster.x - player.x;
              const dy = monster.y - player.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              if (dist < player.attackRange + 20) { 
                  io.emit('playerMoved', { 
                      id: socket.id, 
                      x: player.x, 
                      y: player.y,
                      state: 'attack', 
                      direction: player.x < monster.x ? 'right' : 'left',
                      targetX: player.x, 
                      targetY: player.y
                  });

                  // Calculate Damage
                  let baseDmg = 10;
                  if (player.stats && player.stats.attack) {
                      baseDmg = player.stats.attack;
                  } else {
                      // Server Fallback
                      const classType = player.class || 'sword';
                      const baseStr = (player.stats?.str || 5);
                      const baseDex = (player.stats?.dex || 5);
                      const baseInt = (player.stats?.int || 5);
                      
                      if (classType === 'sword') baseDmg = baseStr * 5;
                      else if (classType === 'archer') baseDmg = baseDex * 3;
                      else if (classType === 'mage') baseDmg = baseInt * 4;
                      else if (classType === 'shield') baseDmg = baseStr * 3;
                  }
                  
                  const variation = Math.floor(baseDmg * 0.2) * (Math.random() < 0.5 ? -1 : 1) * Math.random();
                  const dmg = Math.max(1, Math.floor(baseDmg + variation));

                  monster.hp -= dmg;
                  monster.lastHitTime = Date.now();
                  monster.targetId = socket.id; 
                  
                  io.emit('monsterDamaged', { 
                      monsterId, 
                      hp: monster.hp, 
                      damage: dmg, 
                      attackerId: socket.id,
                      type: 'damage'
                  });
                  
                  if (monster.hp <= 0) {
                      delete monsters[monsterId];
                      const expAmount = monster.exp || 10;
                      io.emit('monsterDead', { monsterId, killerId: socket.id });

                      // EXP Orb (Always)
                      const expItem = {
                          id: uuid(),
                          x: monster.x,
                          y: monster.y,
                          itemId: 'exp_orb',
                          name: '경험치',
                          color: 'purple',
                          type: 'exp',
                          amount: expAmount,
                          ownerId: socket.id,
                          dropTime: Date.now()
                      };
                      socket.emit('autoLoot', expItem);
                      
                      // --- Drop Logic using Drop Table ---
                      const dropTable = monster.dropTable;
                      if (dropTable) {
                          const dropRoll = Math.random();
                          // 1. Gold
                          if (dropTable.gold && Math.random() < dropTable.gold.chance) {
                               const g = dropTable.gold;
                               const amount = Math.floor(Math.random() * (g.max - g.min + 1)) + g.min;
                               const goldItem = {
                                   id: uuid(),
                                   x: monster.x,
                                   y: monster.y,
                                   itemId: 'gold',
                                   name: '골드',
                                   color: 'gold',
                                   type: 'gold',
                                   amount: amount,
                                   ownerId: socket.id,
                                   dropTime: Date.now()
                               };
                               socket.emit('autoLoot', goldItem);
                          }

                          // 2. Materials (and other items defined in 'materials' list)
                          if (dropTable.materials) {
                              dropTable.materials.forEach(mat => {
                                  if (Math.random() < mat.chance) {
                                      // Find item definition from loaded data
                                      const itemDef = GAME_DATA.items.find(i => i.id === mat.itemId);
                                      if (!itemDef) return;

                                      const droppedItem = {
                                           id: uuid(),
                                           x: monster.x + (Math.random() * 40 - 20),
                                           y: monster.y + (Math.random() * 40 - 20),
                                           itemId: itemDef.id,
                                           name: itemDef.name,
                                           color: itemDef.type === 'consumable' ? '#FFaaaa' : '#eeeeee',
                                           type: itemDef.type,
                                           subType: itemDef.subType,
                                           effect: itemDef.effect,
                                           stackable: itemDef.stackable,
                                           amount: Math.floor(Math.random() * (mat.max - mat.min + 1)) + mat.min,
                                           ownerId: socket.id,
                                           dropTime: Date.now()
                                      };
                                      socket.emit('autoLoot', droppedItem);
                                  }
                              });
                          }

                          // 3. Equipment
                          if (dropTable.equipment && Math.random() < dropTable.equipment.chance) {
                              // Determine grade based on maxGrade or server config
                              // For simplicity, let's use global grade config probabilities but cap at maxGrade?
                              // Or just simple weighted random.
                              // Let's use simple logic: Common (70%), Rare (30%) if max is Rare.
                              
                              let grade = 'common';
                              const r = Math.random();
                              if (r < 0.8) grade = 'common';
                              else if (r < 0.95) grade = 'rare';
                              else grade = 'epic'; // very low chance default

                              // Override by maxGrade limitation logic if needed, but for now allow luck.
                              
                              const equipData = generateEquipment(grade);
                              if (equipData) {
                                  const equipItem = {
                                       id: uuid(),
                                       x: monster.x + (Math.random() * 40 - 20),
                                       y: monster.y + (Math.random() * 40 - 20),
                                       ...equipData,
                                       ownerId: socket.id,
                                       dropTime: Date.now()
                                   };
                                   socket.emit('autoLoot', equipItem);
                              }
                          }
                      }
                      
                      // Respawn
                      setTimeout(() => {
                          if (Object.keys(monsters).length < MONSTER_COUNT * 3) {
                              // Re-spawn a random monster type from DB (weighted?)
                              // For now, reuse logic
                              const definitions = Object.values(GAME_DATA.monsterStats);
                              if (definitions.length > 0) {
                                  const def = definitions[Math.floor(Math.random() * definitions.length)];
                                  const newId = uuid();
                                  monsters[newId] = {
                                      id: newId,
                                      x: Math.random() * MAP_WIDTH,
                                      y: Math.random() * MAP_HEIGHT,
                                      hp: def.hp,
                                      maxHp: def.maxHp,
                                      attack: def.attack,
                                      defense: def.defense,
                                      exp: def.exp,
                                      speed: def.speed,
                                      name: def.name, // Copy name from DB definition
                                      type: def.type,
                                      variant: def.variant,
                                      state: 'idle',
                                      targetId: null,
                                      lastHitTime: 0,
                                      aggroRange: def.aggroRange,
                                      isAggressive: def.aggroRange > 0,
                                      attackRange: def.attackRange,
                                      damage: def.attack,
                                      dropTable: def.dropTable
                                  };
                                  io.emit('monsterUpdate', monsters);
                              }
                          }
                      }, 3000);
                  }
              }
          }
      });

      // 6. Handle Item Drop Request
      socket.on('itemDropRequest', (itemData) => {
          if (!items[itemData.id]) {
              items[itemData.id] = {
                  ...itemData,
                  dropTime: Date.now() 
              };
              io.emit('itemDropped', items[itemData.id]);
          }
      });

      // 7. Handle Admin
      socket.on('adminCommand', (cmd) => {
          console.log(`Admin Command from ${socket.id}: ${cmd}`);
          if (cmd === '/clean' || cmd === '/청소') {
              items = {}; 
              io.emit('itemsCleared');
          }
      });

      // 8. Handle Respawn
      socket.on('respawn', () => {
          const player = players[socket.id];
          if (player) {
              const maxHp = (player.stats && player.stats.hp) ? player.stats.hp : 500;
              player.hp = maxHp; 
              player.state = 'idle';
              player.x = 400 + Math.random() * 50; 
              player.y = 300 + Math.random() * 50;
              io.emit('playerRespawn', player);
          }
      });

      // 9. Handle Pickup
      socket.on('pickupItem', (itemId) => {
          const item = items[itemId];
          const player = players[socket.id];
          
          if (item && player) {
              const dx = item.x - player.x;
              const dy = item.y - player.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              if (dist < 60) { 
                  const isOwner = item.ownerId === socket.id;
                  const isExpired = (Date.now() - item.dropTime) > 30000;

                  if (isOwner || isExpired) {
                      delete items[itemId];
                      io.emit('itemPicked', { itemId, playerId: socket.id });
                      socket.emit('inventoryAdd', { 
                          itemId: item.itemId, 
                          name: item.name, 
                          type: item.type,
                          amount: item.amount,
                          subType: item.subType,
                          stats: item.stats,
                          grade: item.grade,
                          levelRequirement: item.levelRequirement
                      });
                  }
              }
          }
      });

      // 10. Disconnect
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
      });
    });

    // --- Server Loop (20 ticks/sec) ---
    setInterval(() => {
      const now = Date.now();
      
      // Check Items
      Object.keys(items).forEach(id => {
          if (now - items[id].dropTime > 35000) { 
              delete items[id];
              io.emit('itemExpired', { itemId: id });
          }
      });

      // Check Monsters
      Object.keys(monsters).forEach(id => {
        const monster = monsters[id];
        
        // AI: Find Target
        let target = null;
        if (monster.targetId && players[monster.targetId]) {
            target = players[monster.targetId];
        } else if (monster.isAggressive) {
            let minDist = monster.aggroRange;
            Object.values(players).forEach(p => {
                if (p.state === 'dead') return;
                const d = Math.sqrt(Math.pow(p.x - monster.x, 2) + Math.pow(p.y - monster.y, 2));
                if (d < minDist) {
                    minDist = d;
                    target = p;
                }
            });
        }

        if (target) {
            if (target.state === 'dead') {
                monster.targetId = null;
                monster.state = 'idle';
            } else {
                monster.targetId = target.id;
                const dx = target.x - monster.x;
                const dy = target.y - monster.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist > monster.attackRange) {
                    // Chase
                    const speed = monster.speed || 2.0;
                    monster.x += (dx / dist) * speed;
                    monster.y += (dy / dist) * speed;
                    monster.state = 'walk';
                } else {
                    // Attack
                    if (now - (monster.lastAttackTime || 0) > 1000) {
                        monster.lastAttackTime = now;
                        monster.state = 'attack';
                        monster.attackEndTime = now + 500;
                        
                        target.hp -= monster.damage;
                        if (target.hp < 0) target.hp = 0;

                        if (target.hp <= 0) {
                            target.hp = 0;
                            target.state = 'dead';
                            io.emit('playerDead', { playerId: target.id });
                            
                            Object.values(monsters).forEach(m => {
                                if (m.targetId === target.id) {
                                    m.targetId = null;
                                    m.state = 'idle';
                                }
                            });
                        }

                        io.emit('playerDamaged', {
                            playerId: target.id,
                            damage: monster.damage,
                            hp: target.hp
                        });
                    } else {
                        if (now > (monster.attackEndTime || 0)) {
                            monster.state = 'idle';
                        }
                    }
                }
            }
        } else {
            // Idle / Regen
            if (!monster.targetId && monster.hp < monster.maxHp) {
                 monster.hp = Math.min(monster.maxHp, monster.hp + monster.maxHp * 0.05);
            }

            if (now - monster.lastHitTime > 3000) {
                if (Math.random() < 0.01) { 
                    monster.targetX = Math.random() * MAP_WIDTH;
                    monster.targetY = Math.random() * MAP_HEIGHT;
                    monster.state = 'walk';
                }

                if (monster.state === 'walk' && monster.targetX) {
                    const dx = monster.targetX - monster.x;
                    const dy = monster.targetY - monster.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const speed = 1.0;

                    if (dist > speed) {
                        monster.x += (dx / dist) * speed;
                        monster.y += (dy / dist) * speed;
                    } else {
                        monster.state = 'idle';
                        monster.x = monster.targetX;
                        monster.y = monster.targetY;
                    }
                }
            }
        }
      });

      io.emit('monsterUpdate', monsters);

    }, 50); 
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Railway requires binding to 0.0.0.0

server.listen(PORT, HOST, () => {
  console.log(`Game Server running on ${HOST}:${PORT}`);
});