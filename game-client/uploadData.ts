
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch, collection } from "firebase/firestore";
import { ITEM_DB, MONSTER_DB } from './src/data/gameData';

// Firebase Config (Copy your config here or import it if possible)
// Since this is a standalone script run by ts-node or similar, we might need to hardcode config or load env
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

