
// Basic Node.js Script (CommonJS) to avoid TS module hell for simple scripts
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, writeBatch } = require("firebase/firestore");

// Hardcode Data here to skip import issues
const ITEM_DB = {
    // --- Potions ---
    "potion_hp_small": {
        id: "potion_hp_small",
        name: "소형 체력 포션",
        type: "consumption",
        subType: "hp",
        value: 50, // Heals 50
        desc: "체력을 50 회복합니다.",
        color: "#ff9999" // Visual placeholder
    },
    "potion_mp_small": {
        id: "potion_mp_small",
        name: "소형 마나 포션",
        type: "consumption",
        subType: "mp",
        value: 30,
        desc: "마나를 30 회복합니다.",
        color: "#9999ff"
    },

    // --- Weapons ---
    "sword_wooden": {
        id: "sword_wooden",
        name: "목검",
        type: "equipment",
        subType: "weapon",
        stats: { str: 5, atk: 10 },
        desc: "초보자를 위한 목검입니다.",
        color: "#8b4513"
    },
    "sword_iron": {
        id: "sword_iron",
        name: "철검",
        type: "equipment",
        subType: "weapon",
        stats: { str: 10, atk: 25 },
        desc: "날카로운 철검입니다.",
        color: "#c0c0c0"
    },

    // --- Armor ---
    "armor_leather": {
        id: "armor_leather",
        name: "가죽 갑옷",
        type: "equipment",
        subType: "armor",
        stats: { hp: 50, def: 5 },
        desc: "가볍고 질긴 가죽 갑옷입니다.",
        color: "#8b4513"
    },
    "helm_leather": {
        id: "helm_leather",
        name: "가죽 투구",
        type: "equipment",
        subType: "head",
        stats: { hp: 20, def: 2 },
        desc: "기본적인 머리 보호구입니다.",
        color: "#8b4513"
    },

    // --- Materials ---
    "bone_fragment": {
        id: "bone_fragment",
        name: "뼈 조각",
        type: "material",
        subType: "none",
        desc: "스켈레톤의 뼈 조각입니다.",
        color: "#eeeeee"
    }
};

const MONSTER_DB = {
    "skeleton_warrior": {
        id: "skeleton_warrior",
        name: "스켈레톤 전사",
        hp: 100,
        maxHp: 100,
        damage: 10,
        speed: 1.5,
        attackRange: 40,
        aggroRange: 200,
        isAggressive: true, // Red
        sprite: { type: 'sword', variant: 'red' },
        dropTable: [
            { itemId: "potion_hp_small", chance: 0.3 },
            { itemId: "bone_fragment", chance: 0.5 },
            { itemId: "sword_wooden", chance: 0.1 }
        ]
    },
    "skeleton_worker": {
        id: "skeleton_worker",
        name: "스켈레톤 일꾼",
        hp: 80,
        maxHp: 80,
        damage: 5,
        speed: 1.0,
        attackRange: 40,
        aggroRange: 0, // Passive
        isAggressive: false, // Green
        sprite: { type: 'sword', variant: 'green' },
        dropTable: [
            { itemId: "potion_hp_small", chance: 0.1 },
            { itemId: "bone_fragment", chance: 0.4 }
        ]
    }
};

const firebaseConfig = {
    apiKey: "AIzaSyDA-AyKLVFHwUWBPPChTcZD0VaMpf-GkXA",
    authDomain: "pkrpg-fe04e.firebaseapp.com",
    projectId: "pkrpg-fe04e",
    storageBucket: "pkrpg-fe04e.firebasestorage.app",
    messagingSenderId: "268844122542",
    appId: "1:268844122542:web:9e5053cfc6f0694831483f",
    measurementId: "G-WZW7J4Q9CD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uploadData = async () => {
    console.log("Starting Data Upload...");
    const batch = writeBatch(db);

    // 1. Items
    console.log("Processing Items...");
    Object.values(ITEM_DB).forEach(item => {
        const ref = doc(db, "items", item.id);
        batch.set(ref, item);
    });

    // 2. Monsters
    console.log("Processing Monsters...");
    Object.values(MONSTER_DB).forEach(monster => {
        const ref = doc(db, "monsters", monster.id);
        batch.set(ref, monster);
    });

    try {
        await batch.commit();
        console.log("Data Upload Successful!");
    } catch (e) {
        console.error("Error uploading data:", e);
    }
};

uploadData();

