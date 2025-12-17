const { db } = require('./firebase');
const { doc, setDoc } = require("firebase/firestore");

// Master Data to Upload

const DROP_CHANCE = {
    GOLD: 0.70,      // 0 ~ 0.70 (70%)
    MATERIAL: 0.98,  // 0.70 ~ 0.98 (28%)
    EQUIPMENT: 1.00  // 0.98 ~ 1.00 (2%)
};

const EQUIPMENT_GRADE_CHANCE = {
    COMMON: 0.70,   // 70%
    RARE: 0.95,     // 25%
    EPIC: 1.00      // 5%
};

const EQUIPMENT_DATABASE = {
    weapons: [
        { id: "sword", name: "검", type: "weapon", baseAtk: 10 },
        { id: "bow", name: "활", type: "weapon", baseAtk: 15 },
        { id: "staff", name: "지팡이", type: "weapon", baseAtk: 20 }
    ],
    armors: [
        { id: "armor", name: "갑옷", type: "armor", baseDef: 5, baseHp: 50 },
        { id: "helm", name: "투구", type: "head", baseDef: 2, baseHp: 20 },
        { id: "leggings", name: "각반", type: "leg", baseDef: 3, baseHp: 30 }
    ]
};

const GOLD_DROPS = {
    'red': { min: 50, max: 150 },
    'green': { min: 10, max: 50 }
};

const DROP_TABLES = {
    'red': [ // Warrior Monster Drops (Misc)
        { itemId: "potion_hp_small", chance: 0.3, name: "소형 체력 포션", color: "#ff9999", type: "potion" },
        // Bone fragment handled by global material chance
    ],
    'green': [ // Worker Monster Drops (Misc)
        { itemId: "potion_hp_small", chance: 0.1, name: "소형 체력 포션", color: "#ff9999", type: "potion" },
    ]
};

async function uploadData() {
    console.log("Uploading Game Data to Firestore...");

    try {
        await setDoc(doc(db, "gameData", "dropConfig"), {
            dropChance: DROP_CHANCE,
            equipmentGradeChance: EQUIPMENT_GRADE_CHANCE,
            goldDrops: GOLD_DROPS
        });
        console.log("Uploaded dropConfig");

        await setDoc(doc(db, "gameData", "equipmentData"), {
            ...EQUIPMENT_DATABASE
        });
        console.log("Uploaded equipmentData");

        await setDoc(doc(db, "gameData", "dropTables"), {
            tables: DROP_TABLES
        });
        console.log("Uploaded dropTables");

        console.log("Data upload complete!");
        process.exit(0);
    } catch (error) {
        console.error("Error uploading data:", error);
        process.exit(1);
    }
}

uploadData();
