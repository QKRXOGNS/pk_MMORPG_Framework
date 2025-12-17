export const GRADE_NAMES = {
    common: "일반",
    rare: "희귀",
    epic: "서사",
    heroic: "영웅",
    legendary: "전설"
};

export const GRADE_COLORS = {
    common: "#A0A0A0", // Grey
    rare: "#4169E1",   // Royal Blue
    epic: "#9370DB",   // Medium Purple
    heroic: "#FFD700", // Gold
    legendary: "#FF4500" // Orange Red
};

export const DISASSEMBLE_REWARDS = {
    common: { gold: { min: 10, max: 50 }, bone: { min: 1, max: 3 } },
    rare: { gold: { min: 100, max: 300 }, bone: { min: 5, max: 10 } },
    epic: { gold: { min: 1000, max: 2000 }, bone: { min: 20, max: 40 } },
    heroic: { gold: { min: 5000, max: 10000 }, bone: { min: 50, max: 100 } },
    legendary: { gold: { min: 50000, max: 100000 }, bone: { min: 200, max: 500 } }
};
