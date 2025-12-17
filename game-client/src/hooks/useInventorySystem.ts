import { useState } from 'react';
import { DISASSEMBLE_REWARDS } from '../data/gameData';

interface UseInventorySystemProps {
    characterData: any;
    handleAddLog: (msg: string) => void;
    onPotionEquip: (itemId: string, name: string) => void;
    onEquipmentChange: (newEquipment: any) => void;
}

export const useInventorySystem = ({
    handleAddLog,
    onPotionEquip,
    onEquipmentChange
}: UseInventorySystemProps) => {
    // State
    const [inventory, setInventory] = useState<any[]>([]);
    const [equipment, setEquipment] = useState<{ [key: string]: any }>({
        head: null, armor: null, leg: null, weapon: null
    });
    const [gold, setGold] = useState(0);

    // Disassemble State
    const [disassembleMode, setDisassembleMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [autoDisassembleSettings, setAutoDisassembleSettings] = useState<{
        enabled: boolean;
        grades: string[]; // ['common', 'rare', 'epic', 'heroic', 'legendary']
    }>({
        enabled: false,
        grades: []
    });

    // Disassemble Item Helper
    const disassembleItem = (item: any): { gold: number, bone: number } | null => {
        if (!item || item.type !== 'equipment') {
            return null;
        }

        const grade = item.grade || 'common';
        const rewards = DISASSEMBLE_REWARDS[grade as keyof typeof DISASSEMBLE_REWARDS] || DISASSEMBLE_REWARDS.common;
        
        const goldReward = Math.floor(Math.random() * (rewards.gold.max - rewards.gold.min + 1)) + rewards.gold.min;
        const boneReward = Math.floor(Math.random() * (rewards.bone.max - rewards.bone.min + 1)) + rewards.bone.min;

        return { gold: goldReward, bone: boneReward };
    };

    // Handle Inventory Add (with Auto Disassemble)
    const handleInventoryAdd = (item: { itemId: string, name: string, type?: string, amount?: number, subType?: string, stats?: any, grade?: string, levelRequirement?: number }) => {
        // 1. Check Auto Disassemble
        if (item.type === 'equipment' && autoDisassembleSettings.enabled && item.grade) {
            if (autoDisassembleSettings.grades.includes(item.grade)) {
                // Execute Auto Disassemble immediately
                const rewards = disassembleItem(item);
                if (rewards) {
                    setGold(prev => prev + rewards.gold);
                    setInventory(prev => {
                         const existingBoneIndex = prev.findIndex(i => i.itemId === 'bone_fragment');
                         if (existingBoneIndex !== -1) {
                             const newInventory = [...prev];
                             newInventory[existingBoneIndex] = {
                                 ...newInventory[existingBoneIndex],
                                 amount: (newInventory[existingBoneIndex].amount || 1) + rewards.bone
                             };
                             return newInventory;
                         } else {
                             return [...prev, {
                                 itemId: 'bone_fragment',
                                 name: '뼈 조각',
                                 type: 'material',
                                 amount: rewards.bone
                             }];
                         }
                    });
                    handleAddLog(`[자동분해] ${item.name} 분해됨 (+${rewards.gold}G, +${rewards.bone}뼈)`);
                    return; // Do NOT add to inventory
                }
            }
        }

        if (item.type === 'gold') {
            setGold(prev => prev + (item.amount || 0));
        } else {
            setInventory(prev => {
                // Check if item is stackable (consumable/potion or material)
                const isStackable = item.type === 'consumable' || item.type === 'material' || (item as any).stackable;
                const existingItemIndex = prev.findIndex(i => i.itemId === item.itemId);

                if (isStackable && existingItemIndex !== -1) {
                    // Stack existing item
                    const newInventory = [...prev];
                    const existingItem = newInventory[existingItemIndex];
                    
                    newInventory[existingItemIndex] = {
                        ...existingItem,
                        amount: (existingItem.amount || 1) + (item.amount || 1)
                    };
                    return newInventory;
                } else {
                    // Add new slot
                    return [...prev, { ...item, amount: item.amount || 1 }];
                }
            });
        }
    };

    // Toggle Item Selection
    const toggleItemSelection = (index: number) => {
        if (!disassembleMode) return;
        
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                const item = inventory[index];
                if (item && item.type === 'equipment') {
                    newSet.add(index);
                }
            }
            return newSet;
        });
    };

    // Handle Disassemble Selected Items
    const handleDisassembleSelected = () => {
        if (selectedItems.size === 0) {
            handleAddLog("분해할 아이템을 선택해주세요.");
            return;
        }

        let calculatedGold = 0;
        let calculatedBone = 0;
        let count = 0;
        const itemIdsToRemove = new Set<string>();

        // 1. Calculate Rewards & Identify items to remove
        inventory.forEach((item, index) => {
            if (selectedItems.has(index)) {
                if (item.type === 'equipment') {
                    const rewards = disassembleItem(item);
                    if (rewards && item.itemId) {
                        calculatedGold += rewards.gold;
                        calculatedBone += rewards.bone;
                        itemIdsToRemove.add(item.itemId);
                        count++;
                    } else if (rewards && !item.itemId) {
                        console.warn("Equipment missing itemId, skipping disassemble:", item);
                        handleAddLog(`[System] 오류: ${item.name}에 식별자(itemId)가 없어 분해할 수 없습니다.`);
                    }
                }
            }
        });

        if (count === 0) {
            if (selectedItems.size > 0) {
                handleAddLog("선택된 아이템 중 분해 가능한 장비가 없거나 오류가 발생했습니다.");
            }
            return;
        }

        // 2. Update Inventory
        setInventory(prev => {
            const newInventory = prev.filter(item => {
                if (item.type === 'equipment' && item.itemId) {
                    return !itemIdsToRemove.has(item.itemId);
                }
                return true;
            });

            // Add Bone Fragments
            if (calculatedBone > 0) {
                 const existingBoneIndex = newInventory.findIndex(i => i.itemId === 'bone_fragment');
                 if (existingBoneIndex !== -1) {
                     newInventory[existingBoneIndex] = {
                         ...newInventory[existingBoneIndex],
                         amount: (newInventory[existingBoneIndex].amount || 1) + calculatedBone
                     };
                 } else {
                     newInventory.push({
                         itemId: 'bone_fragment',
                         name: '뼈 조각',
                         type: 'material',
                         amount: calculatedBone
                     });
                 }
            }
            return newInventory;
        });

        // 3. Update Gold & Log
        setGold(prev => prev + calculatedGold);
        handleAddLog(`${count}개의 아이템을 분해했습니다. (골드: +${calculatedGold}, 뼈 조각: +${calculatedBone})`);
        
        // 4. Reset Selection
        setSelectedItems(new Set());
        setDisassembleMode(false);
    };

    // Equip Item
    const handleEquip = (index: number) => {
        const item = inventory[index];
        if (!item) return;
        
        // Potion Equip Logic (Delegated)
        if (item.type === 'consumable' && item.subType === 'potion') {
            onPotionEquip(item.itemId, item.name);
            return;
        }

        if (item.type !== 'equipment') return;

        const slotMap: { [key: string]: string } = {
            'weapon': 'weapon',
            'armor': 'armor',
            'head': 'head',
            'leg': 'leg'
        };
        
        const targetSlot = slotMap[item.subType];
        if (!targetSlot) {
            handleAddLog("장착할 수 없는 아이템입니다.");
            return;
        }

        const currentEquipped = equipment[targetSlot];
        const newInventory = [...inventory];
        
        // Remove item from inventory
        newInventory.splice(index, 1);
        
        // If there was an item equipped, return it to inventory
        if (currentEquipped) {
            newInventory.push(currentEquipped);
        }
        
        setInventory(newInventory);
        handleAddLog(`${item.name}을(를) 장착했습니다.`);
        
        const newEquipment = {
            ...equipment,
            [targetSlot]: item
        };
        
        setEquipment(newEquipment);
        onEquipmentChange(newEquipment);
    };

    // Unequip Item
    const handleUnequip = (slot: string) => {
        const item = equipment[slot];
        if (!item) return;

        if (inventory.length >= 24) {
            handleAddLog("인벤토리가 가득 차서 장비를 해제할 수 없습니다.");
            return;
        }

        const newEquipment = {
            ...equipment,
            [slot]: null
        };
        
        setEquipment(newEquipment);
        setInventory(prev => [...prev, item]);
        handleAddLog(`${item.name} 장착을 해제했습니다.`);
        
        onEquipmentChange(newEquipment);
    };

    return {
        inventory,
        setInventory,
        equipment,
        setEquipment,
        gold,
        setGold,
        disassembleMode,
        setDisassembleMode,
        selectedItems,
        setSelectedItems,
        autoDisassembleSettings,
        setAutoDisassembleSettings,
        handleInventoryAdd,
        handleEquip,
        handleUnequip,
        handleDisassembleSelected,
        toggleItemSelection
    };
};

