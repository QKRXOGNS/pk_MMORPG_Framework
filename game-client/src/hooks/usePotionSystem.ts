import { useState, useEffect } from 'react';

interface UsePotionSystemProps {
    inventory: any[];
    setInventory: React.Dispatch<React.SetStateAction<any[]>>;
    currentHp: number;
    setCurrentHp: React.Dispatch<React.SetStateAction<number>>;
    statsInfo: any;
    handleAddLog: (msg: string) => void;
    equippedPotionId: string | null;
    setEquippedPotionId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const usePotionSystem = ({
    inventory,
    setInventory,
    currentHp,
    setCurrentHp,
    statsInfo,
    handleAddLog,
    equippedPotionId,
    setEquippedPotionId
}: UsePotionSystemProps) => {
    const [autoPotionSettings, setAutoPotionSettings] = useState({ enabled: false, threshold: 50 });
    const [potionCooldownEnd, setPotionCooldownEnd] = useState<number>(0);
    const [showPotionSettings, setShowPotionSettings] = useState(false);
    const [cooldownProgress, setCooldownProgress] = useState(0);

    // Cooldown Progress Timer
    useEffect(() => {
        if (potionCooldownEnd > Date.now()) {
            const interval = setInterval(() => {
                const remaining = potionCooldownEnd - Date.now();
                if (remaining <= 0) {
                    setCooldownProgress(0);
                    clearInterval(interval);
                } else {
                    setCooldownProgress((remaining / 5000) * 100);
                }
            }, 100);
            return () => clearInterval(interval);
        } else {
            setCooldownProgress(0);
        }
    }, [potionCooldownEnd]);

    const usePotion = () => {
        const now = Date.now();
        if (now < potionCooldownEnd) {
            handleAddLog("[System] 포션 쿨타임 중입니다.");
            return;
        }
        
        const pItemIndex = inventory.findIndex(i => i.itemId === equippedPotionId);
        if (pItemIndex === -1) {
            handleAddLog("[System] 장착된 포션이 없습니다.");
            // setEquippedPotionId(null); 
            return;
        }
        
        const pItem = inventory[pItemIndex];
        const healAmount = (pItem.effect && pItem.effect.amount) ? pItem.effect.amount : 50;

        if (!statsInfo || currentHp >= statsInfo.total.hp) return;

        const newHp = Math.min(currentHp + healAmount, statsInfo.total.hp);

        setCurrentHp(newHp);
        
        setInventory(prev => {
            const newInv = [...prev];
            const item = newInv[pItemIndex];
            if (item.amount > 1) {
                newInv[pItemIndex] = { ...item, amount: item.amount - 1 };
            } else {
                newInv.splice(pItemIndex, 1);
            }
            return newInv;
        });

        setPotionCooldownEnd(now + 5000);
        handleAddLog(`[System] ${pItem.name} 사용 (HP +${healAmount})`);
    };

    // Auto Potion Logic (Event-driven + Polling)
    useEffect(() => {
        if (!autoPotionSettings.enabled || !equippedPotionId) return;

        const checkAndUsePotion = () => {
            if (!statsInfo) return;

            // 1. Cooldown check
            if (Date.now() < potionCooldownEnd) return;
            
            // 2. Full HP check
            if (currentHp >= statsInfo.total.hp) return;

            // 3. Threshold check
            const hpPercent = (currentHp / statsInfo.total.hp) * 100;
            if (hpPercent <= autoPotionSettings.threshold) {
                usePotion();
            }
        };

        // Check immediately on state change
        checkAndUsePotion();

        // Poll frequently (0.5s) to catch cooldown expiry
        const interval = setInterval(checkAndUsePotion, 500);
        return () => clearInterval(interval);
    }, [currentHp, statsInfo, autoPotionSettings, equippedPotionId, potionCooldownEnd, inventory]);

    const handlePotionEquip = (e: any, item: any) => {
        e.preventDefault();
        if (item.type === 'consumable' && item.subType === 'potion') {
            setEquippedPotionId(item.itemId);
            handleAddLog(`[System] ${item.name} 장착 완료.`);
        }
    };

    return {
        equippedPotionId,
        setEquippedPotionId,
        autoPotionSettings,
        setAutoPotionSettings,
        potionCooldownEnd,
        showPotionSettings,
        setShowPotionSettings,
        cooldownProgress,
        usePotion,
        handlePotionEquip
    };
};

