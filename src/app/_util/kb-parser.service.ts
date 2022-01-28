import { Injectable } from '@angular/core';
import {
    addDamage,
    addFriendlyFire,
    addReceivedDamage,
    addReceivedFriendlyFire,
    CombatRole,
    Unit,
} from '../_model/unit';
import { KB } from '../_model/kb';
import moment from 'moment';
import 'moment/locale/de';

const KB_MAIN_CLASS = 'dl4KBMain';
const UNIT_REGEX =
    /<span class="[ad]\d+?(?:\s(.+?))?" title="([^"]+)\s[(](.+?)[)]">/g;
const UNIT_REGEX_ROLE_INDEX = 1;
const UNIT_REGEX_NAME_INDEX = 2;
const UNIT_REGEX_OWNER_INDEX = 3;
const KB_ROUND_TAG = '<div class="dl4KBRound">';
const KB_LINE_TAG = '<div class="dl4KBLine">';
const KB_KILL_TAG = '<span class="dl4KBKill">';
const DMG_REGEX = /erleidet (\d*) Schaden/;
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

    private static parseRounds(rounds: Array<string>): Array<Unit> {
        const units = new Map<string, Unit>();

        rounds.forEach((round, roundIndex) => {
            const lines = KbParserService.getLines(round);
            lines.forEach((line) => {
                KbParserService.parseAttack(line, units, roundIndex);
            });
        });
        return [...units.values()];
    }

    private static parseAttack(
        kbLine: string,
        units: Map<string, Unit>,
        roundIndex: number
    ): void {
        const matchedUnits = [...kbLine.matchAll(UNIT_REGEX)];
        if (matchedUnits.length < 2) return;
        const matchedAttacker = matchedUnits[0];
        const matchedDefender = matchedUnits[1];

        const attackerName = KbParserService.normalizeUnitName(
            matchedAttacker[UNIT_REGEX_NAME_INDEX]
        );
        const attackerOwner = matchedAttacker[UNIT_REGEX_OWNER_INDEX];
        const attackerRole =
            matchedAttacker[UNIT_REGEX_ROLE_INDEX] === 'aggressor'
                ? CombatRole.AGGRESSOR
                : CombatRole.DEFENDER;
        const attackerMapKey = KbParserService.unitMapKey(
            attackerName,
            attackerOwner
        );

        const attacker =
            units.get(attackerMapKey) ||
            KbParserService.emptyUnit(
                attackerName,
                attackerOwner,
                attackerRole
            );

        const defenderName = KbParserService.normalizeUnitName(
            matchedDefender[UNIT_REGEX_NAME_INDEX]
        );
        const defenderOwner = matchedDefender[UNIT_REGEX_OWNER_INDEX];
        const defenderRole =
            matchedDefender[UNIT_REGEX_ROLE_INDEX] === 'aggressor'
                ? CombatRole.AGGRESSOR
                : CombatRole.DEFENDER;
        const defenderMapKey = KbParserService.unitMapKey(
            defenderName,
            defenderOwner
        );

        const defender =
            units.get(defenderMapKey) ||
            KbParserService.emptyUnit(
                defenderName,
                defenderOwner,
                defenderRole
            );

        const dmg = KbParserService.parseDamage(kbLine);
        const exp = KbParserService.parseEXP(kbLine);
        const kills = KbParserService.parseKills(kbLine);
        const isFriendlyFire = attackerOwner === defenderOwner;

        if (isFriendlyFire) {
            addFriendlyFire(attacker, dmg);
            addReceivedFriendlyFire(defender, dmg);
        } else {
            addDamage(attacker, roundIndex, dmg);
            addReceivedDamage(defender, roundIndex, dmg);
        }

        attacker.exp += exp;
        attacker.kills += kills;

        units.set(attackerMapKey, attacker);
        units.set(defenderMapKey, defender);
    }

    private static unitMapKey(name: string, owner: string): string {
        return `${owner}:${name}`;
    }

    private static emptyUnit(
        name: string,
        owner: string,
        combatRole: CombatRole
    ): Unit {
        return {
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
            receivedDamage: {
                total: 0,
                friendlyFire: 0,
                rounds: [],
            },
        };
    }

    private static parseDamage(line: string): number {
        const dmgMatch = DMG_REGEX.exec(line);
        return dmgMatch ? parseInt(dmgMatch[1]) : 0;
    }

    private static parseEXP(line: string): number {
        const expMatch = EXP_REGEX.exec(line);
        return expMatch ? parseInt(expMatch[1]) : 0;
    }

    private static parseKills(line: string): number {
        return line.indexOf(KB_KILL_TAG) >= 0 ? 1 : 0;
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

        const units = KbParserService.parseRounds(rounds);

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
}
