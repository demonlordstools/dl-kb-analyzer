export interface Unit {
    name: string;
    damage: { total: number; rounds: Array<number> };
}

export function addDamage(unit: Unit, round: number, dmg: number): void {
    unit.damage.total = (unit.damage.total || 0) + dmg;
    unit.damage.rounds[round] = (unit.damage.rounds[round] || 0) + dmg;
}
