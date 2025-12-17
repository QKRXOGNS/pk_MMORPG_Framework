const { db } = require('./firebase');
const { collection, doc, setDoc } = require("firebase/firestore");

async function refactorDatabase() {
    console.log("Starting Database Refactoring...");

    // 1. Delete old 'gameData' collection (Clean up)
    console.log("Note: Old 'gameData' collection will be ignored. Creating new structures...");

    // ==========================================
    // 2. Define New Data Structures
    // ==========================================

    // --- A. Monster Table (스탯 하향 조정) ---
    const monsters = [
        {
            id: "skeleton_weak",
            name: "약한 스켈레톤",
            type: "skeleton",
            variant: "green", // passive
            hp: 50,        // 100 → 50 (1-2타에 처치)
            maxHp: 50,
            attack: 3,     // 5 → 3 (데미지 감소)
            defense: 0,
            exp: 15,       // 10 → 15 (경험치 증가)
            speed: 1.0,
            aggroRange: 0, // passive
            attackRange: 40,
            dropTable: {
                gold: { min: 15, max: 40, chance: 0.8 },  // 골드 증가
                materials: [
                    { itemId: "bone_fragment", chance: 0.35, min: 1, max: 3 },
                    { itemId: "potion_hp_small", chance: 0.08, min: 1, max: 1 }
                ],
                equipment: { chance: 0.03, maxGrade: "rare" }
            }
        },
        {
            id: "skeleton_worker",
            name: "스켈레톤 일꾼",
            type: "skeleton",
            variant: "green", // passive
            hp: 80,        // 150 → 80 (2-3타에 처치)
            maxHp: 80,
            attack: 5,     // 15 → 5 (데미지 대폭 감소)
            defense: 1,    // 2 → 1
            exp: 25,       // 20 → 25
            speed: 1.2,
            aggroRange: 0, // passive
            attackRange: 40,
            dropTable: {
                gold: { min: 30, max: 80, chance: 0.85 },
                materials: [
                    { itemId: "bone_fragment", chance: 0.4, min: 2, max: 4 },
                    { itemId: "potion_hp_small", chance: 0.15, min: 1, max: 2 }
                ],
                equipment: { chance: 0.05, maxGrade: "rare" }
            }
        },
        {
            id: "skeleton_warrior",
            name: "스켈레톤 전사",
            type: "skeleton",
            variant: "red", // aggressive
            hp: 150,       // 300 → 150 (3-4타에 처치)
            maxHp: 150,
            attack: 12,    // 25 → 12 (데미지 절반)
            defense: 3,    // 5 → 3
            exp: 50,       // 30 → 50 (경험치 대폭 증가)
            speed: 1.5,
            aggroRange: 200,
            attackRange: 40,
            dropTable: {
                gold: { min: 80, max: 200, chance: 0.9 },
                materials: [
                    { itemId: "bone_fragment", chance: 0.5, min: 3, max: 6 },
                    { itemId: "potion_hp_small", chance: 0.30, min: 1, max: 3 }
                ],
                equipment: { chance: 0.08, maxGrade: "epic" }  // 장비 드랍률 증가
            }
        }
    ];

    // --- B. Item Table (Base Definitions) ---
    // Grades are applied dynamically to these base items.
    // Added 'leg' (Grieves/Boots) as requested.
    const items = [
        // --- Weapons ---
        { id: "sword_wooden", name: "목검", type: "equipment", subType: "weapon", baseStats: { attack: 10 }, levelReq: 1 },
        { id: "sword_iron", name: "철검", type: "equipment", subType: "weapon", baseStats: { attack: 25 }, levelReq: 10 },
        { id: "sword_steel", name: "강철검", type: "equipment", subType: "weapon", baseStats: { attack: 50 }, levelReq: 20 },
        { id: "sword_mithril", name: "미스릴검", type: "equipment", subType: "weapon", baseStats: { attack: 100 }, levelReq: 30 },
        
        // --- Head (Helmets) ---
        { id: "helm_leather", name: "가죽 투구", type: "equipment", subType: "head", baseStats: { defense: 2, hp: 20 }, levelReq: 1 },
        { id: "helm_iron", name: "철 투구", type: "equipment", subType: "head", baseStats: { defense: 8, hp: 50 }, levelReq: 10 },
        { id: "helm_steel", name: "강철 투구", type: "equipment", subType: "head", baseStats: { defense: 15, hp: 100 }, levelReq: 20 },

        // --- Armor (Body) ---
        { id: "armor_leather", name: "가죽 갑옷", type: "equipment", subType: "armor", baseStats: { defense: 5, hp: 50 }, levelReq: 1 },
        { id: "armor_chain", name: "사슬 갑옷", type: "equipment", subType: "armor", baseStats: { defense: 15, hp: 150 }, levelReq: 10 },
        { id: "armor_plate", name: "판금 갑옷", type: "equipment", subType: "armor", baseStats: { defense: 30, hp: 300 }, levelReq: 20 },

        // --- Legs (New!) ---
        { id: "boots_leather", name: "가죽 부츠", type: "equipment", subType: "leg", baseStats: { defense: 1, hp: 10 }, levelReq: 1 },
        { id: "boots_iron", name: "철제 그리브", type: "equipment", subType: "leg", baseStats: { defense: 5, hp: 30 }, levelReq: 10 },
        { id: "boots_steel", name: "강철 그리브", type: "equipment", subType: "leg", baseStats: { defense: 10, hp: 60 }, levelReq: 20 },

        // --- Materials ---
        { id: "bone_fragment", name: "뼈 조각", type: "material", stackable: true, description: "몬스터의 뼈 조각입니다." },

        // --- Potions ---
        { id: "potion_hp_small", name: "하급 체력 물약", type: "consumable", subType: "potion", effect: { type: "heal_hp", amount: 50 }, stackable: true }
    ];

    // --- C. Server Config (Drop Rates, Grade Logic) ---
    const serverConfig = {
        dropRates: {
            globalGoldChance: 0.7,
            globalMaterialChance: 0.3,
            globalEquipmentChance: 0.05
        },
        gradeConfig: {
            // Chance weights (normalized later or used as thresholds)
            chances: {
                common: 0.60,
                rare: 0.25,
                epic: 0.10,
                heroic: 0.04,
                legendary: 0.01
            },
            multipliers: {
                common: 1.0,
                rare: 1.5,
                epic: 2.5,
                heroic: 4.0,
                legendary: 6.0
            },
            colors: {
                common: "#A0A0A0",
                rare: "#4169E1",
                epic: "#9370DB",
                heroic: "#FFD700",
                legendary: "#FF4500"
            }
        }
    };

    // ==========================================
    // 3. Upload Data
    // ==========================================

    try {
        // Upload Monsters
        console.log("Uploading Monsters...");
        for (const monster of monsters) {
            await setDoc(doc(db, 'monsters', monster.id), monster);
        }

        // Upload Items
        console.log("Uploading Items...");
        for (const item of items) {
            await setDoc(doc(db, 'items', item.id), item);
        }

        // Upload Config
        console.log("Uploading Server Config...");
        await setDoc(doc(db, 'serverConfig', 'main'), serverConfig);

        console.log("Database Refactoring Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error during refactoring:", error);
        process.exit(1);
    }
}

refactorDatabase();
