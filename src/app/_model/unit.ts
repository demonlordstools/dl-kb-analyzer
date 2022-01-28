export enum CombatRole {
    AGGRESSOR = 'AGGRESSOR',
    DEFENDER = 'DEFENDER',
}

export interface Unit {
    name: string;
    owner: string;
    combatRole: CombatRole;
    kills: number;
    exp: number;
    damage: { total: number; rounds: Array<number>; friendlyFire: number };
    receivedDamage: {
        total: number;
        rounds: Array<number>;
        friendlyFire: number;
    };
}

export function addDamage(unit: Unit, round: number, dmg: number): void {
    unit.damage.total = (unit.damage.total || 0) + dmg;
    unit.damage.rounds[round] = (unit.damage.rounds[round] || 0) + dmg;
}

export function addReceivedDamage(
    unit: Unit,
    round: number,
    dmg: number
): void {
    unit.receivedDamage.total = (unit.receivedDamage.total || 0) + dmg;
    unit.receivedDamage.rounds[round] =
        (unit.receivedDamage.rounds[round] || 0) + dmg;
}

export function addFriendlyFire(unit: Unit, dmg: number): void {
    unit.damage.friendlyFire = (unit.damage.friendlyFire || 0) + dmg;
}

export function addReceivedFriendlyFire(unit: Unit, dmg: number): void {
    unit.receivedDamage.friendlyFire =
        (unit.receivedDamage.friendlyFire || 0) + dmg;
}
