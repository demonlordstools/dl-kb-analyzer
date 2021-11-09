import { Injectable } from '@angular/core';
import { addDamage, addFriendlyFire, CombatRole, Unit } from '../_model/unit';
import { KB } from '../_model/kb';
import moment from 'moment';
import 'moment/locale/de';

const KB_MAIN_CLASS = 'dl4KBMain';
const KB_AGGRESSOR_REGEX = /<span class="a(\d+) aggressor"/;
const KB_DEFENDER_REGEX = /<span class="d(\d+)"/;
const KB_ROUND_TAG = '<div class="dl4KBRound">';
const KB_LINE_TAG = '<div class="dl4KBLine">';
const KB_KILL_TAG = '<span class="dl4KBKill">';
const DMG_REGEX = /erleidet (\d*) Schaden/;
const ATTACKER_NAME_REGEX = /">(.*)/;
const OWNER_REGEX = /title=".* \((.*)\)">/;
const DATE_REGEX =
    /Datum des Kampfes<\/span>:<\/th>\s+<td align="left">(.*)<\/td>/;
const SUBJECT_REGEX = /Betreff<\/span>:<\/th>\s+<td align="left">(.*)<\/td>/;
const EXP_REGEX = /<span class="ep">(\d+)<\/span>/;
const STORAGE_KEY = 'kbs';

@Injectable({
    providedIn: 'root',
})
export class KbParserService {
    parser = new DOMParser();

    constructor() {
        moment.locale('de');
    }

    private static getRounds(kbHtml: string) {
        const allRounds: Array<string> = [];
        let idx = kbHtml.indexOf(KB_ROUND_TAG);
        while (idx > -1) {
            const toIdx = kbHtml.indexOf(KB_ROUND_TAG, idx + 1);

            const round =
                toIdx >= 0 ? kbHtml.slice(idx, toIdx) : kbHtml.slice(idx);
            allRounds.push(round);

            idx = toIdx;
        }
        return allRounds;
    }

    private static getLines(round: string): Array<string> {
        const lines: Array<string> = [];
        let idx = round.indexOf(KB_LINE_TAG);
        while (idx > -1) {
            const toIdx = round.indexOf(KB_LINE_TAG, idx + 1);

            const line =
                toIdx >= 0 ? round.slice(idx, toIdx) : round.slice(idx);
            lines.push(line);

            idx = toIdx;
        }
        return lines;
    }

    private static filterRounds(
        allRounds: Array<string>,
        headerPredicate: (header?: string) => boolean
    ): Array<string> {
        return allRounds.filter((round) => {
            const startIdx = KB_ROUND_TAG.length;
            const endIdx = round.indexOf('<', KB_ROUND_TAG.length);
            const roundHeader = round.substring(startIdx, endIdx);
            return headerPredicate(roundHeader);
        });
    }

    private static normalizeUnitName(unitName: string): string {
        if (unitName.indexOf('<img') !== -1) {
            if (unitName.indexOf('">') > -1) {
                return unitName.substring(unitName.indexOf('">') + 2).trim();
            }
            if (unitName.indexOf('"/>') > -1) {
                return unitName.substring(unitName.indexOf('"/>') + 3).trim();
            }
        }

        return unitName.trim();
    }

    private static parseDate(html: string): number {
        const dateMatch = DATE_REGEX.exec(html);
        const dateString = dateMatch ? dateMatch[1] : undefined;
        // Dienstag, 02. November 2021 - 12:44:54
        const date = moment(dateString, 'dddd, DD. MMMM YYYY - HH:mm:ss');
        return date.toDate().getTime();
    }

    private static parseSubject(html: string): string {
        const subjectMatch = SUBJECT_REGEX.exec(html);
        return subjectMatch ? subjectMatch[1] : 'ungültiger Betreff';
    }

    private static storeInLocalStorage(kb: KB): void {
        const kbsJson = localStorage.getItem(STORAGE_KEY) || '{}';
        const kbs = JSON.parse(kbsJson);
        kbs[kb.subject] = kb;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kbs));
    }

    parse(source: string): KB {
        const date = KbParserService.parseDate(source);
        const subject = KbParserService.parseSubject(source);
        const htmlDoc = this.parser.parseFromString(source, 'text/html');
        const mains = htmlDoc.getElementsByClassName(KB_MAIN_CLASS);
        if (mains.length !== 1) {
            alert('Ungültiger KB');
            throw 'ungültiger kb';
        }
        const main = mains.item(0);
        const kbHtml = main?.innerHTML || '';

        const allRounds = KbParserService.getRounds(kbHtml);
        const rounds = KbParserService.filterRounds(
            allRounds,
            (header) => header !== '&lt; Kampfvorbereitungen &gt;'
        );

        const units = this.parseRounds(rounds);

        const kb = {
            date,
            subject,
            units,
        };

        KbParserService.storeInLocalStorage(kb);
        return kb;
    }

    storedKBs(): Array<KB> {
        const json = localStorage.getItem(STORAGE_KEY) || '{}';
        const kbsBySubject = JSON.parse(json);
        const kbs: Array<KB> = Object.values(kbsBySubject);
        return kbs.sort((a: KB, b: KB) => b.date - a.date);
    }

    private parseRounds(rounds: Array<string>): Array<Unit> {
        const aggressors = new Map<string, Unit>();
        const defenders = new Map<string, Unit>();

        rounds.forEach((round, roundIndex) => {
            const lines = KbParserService.getLines(round);
            lines.forEach((line) => {
                const startIdx = line.indexOf('<span');
                const endIdx = line.indexOf('</span>');
                const attacker = line.substring(startIdx, endIdx);
                if (KB_AGGRESSOR_REGEX.test(attacker)) {
                    this.parseAttack(
                        attacker,
                        CombatRole.AGGRESSOR,
                        line,
                        aggressors,
                        roundIndex
                    );
                } else if (KB_DEFENDER_REGEX.test(attacker)) {
                    this.parseAttack(
                        attacker,
                        CombatRole.DEFENDER,
                        line,
                        defenders,
                        roundIndex
                    );
                }
            });
        });
        return [...aggressors.values(), ...defenders.values()];
    }

    private parseAttack(
        attackerHTML: string,
        attackerCombatRole: CombatRole,
        line: string,
        units: Map<string, Unit>,
        roundIndex: number
    ) {
        const unitNameNormalized = this.attackerUnitName(attackerHTML);
        const owner = this.owner(attackerHTML);
        const dmg = this.damage(line);
        const exp = this.exp(line);
        const kills = this.kills(line);

        const unit = this.getOrCreateUnit(
            units,
            unitNameNormalized,
            owner,
            attackerCombatRole
        );
        this.isFriendlyFire(line, attackerCombatRole)
            ? addFriendlyFire(unit, dmg)
            : addDamage(unit, roundIndex, dmg);
        unit.exp += exp;
        unit.kills += kills;

        units.set(unitNameNormalized, unit);
    }

    private getOrCreateUnit(
        units: Map<string, Unit>,
        name: string,
        owner: string,
        combatRole: CombatRole
    ): Unit {
        return (
            units.get(name) || {
                name,
                owner,
                combatRole,
                exp: 0,
                kills: 0,
                damage: {
                    total: 0,
                    friendlyFire: 0,
                    rounds: [],
                },
            }
        );
    }

    private owner(attackerHTML: string): string {
        const ownerMatch = OWNER_REGEX.exec(attackerHTML);
        return ownerMatch ? ownerMatch[1] : 'unknown';
    }

    private attackerUnitName(attackerHTML: string): string {
        const nameMatch = ATTACKER_NAME_REGEX.exec(attackerHTML);
        const unitName = nameMatch ? nameMatch[1] : 'unknown';
        return KbParserService.normalizeUnitName(unitName);
    }

    private damage(line: string): number {
        const dmgMatch = DMG_REGEX.exec(line);
        return dmgMatch ? parseInt(dmgMatch[1]) : 0;
    }

    private exp(line: string): number {
        const expMatch = EXP_REGEX.exec(line);
        return expMatch ? parseInt(expMatch[1]) : 0;
    }

    private kills(line: string): number {
        return line.indexOf(KB_KILL_TAG) >= 0 ? 1 : 0;
    }

    private isFriendlyFire(
        line: string,
        attackerCombatRole: CombatRole
    ): boolean {
        const attackPart = line.split('</div>')[0];
        const hitUnitStartIndex = attackPart.lastIndexOf('<span class="');
        const hitUnit = attackPart.substring(hitUnitStartIndex);
        return attackerCombatRole === CombatRole.AGGRESSOR
            ? KB_AGGRESSOR_REGEX.test(hitUnit)
            : KB_DEFENDER_REGEX.test(hitUnit);
    }
}
