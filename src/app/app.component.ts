import { Component, ViewChild } from '@angular/core';
import { KbParserService } from './_util/kb-parser.service';
import { Unit } from './_model/unit';
import { KB } from './_model/kb';
import { MatSort } from '@angular/material/sort';
import { FlatUnit } from './_model/flat-unit';
import { MatDialog } from '@angular/material/dialog';
import { HelpDialogComponent } from './_components/help-dialog/help-dialog.component';
import { AboutDialogComponent } from './_components/about-dialog/about-dialog.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {
    flattenedUnits: Array<FlatUnit> = [];
    storedKBs: Array<KB> = [];

    @ViewChild(MatSort) sort: MatSort | undefined;

    constructor(private kbParser: KbParserService, public dialog: MatDialog) {
        this.storedKBs = kbParser.storedKBs();
    }

    submit(source: string) {
        const kb = this.kbParser.parse(source);
        this.showKB(kb);
        this.storedKBs = this.kbParser.storedKBs();
    }

    name(index: number, unit: Unit): string {
        return unit.name;
    }

    subject(index: number, kb: KB): string {
        return kb.subject;
    }

    showKB(kb: KB): void {
        this.flattenedUnits = flattenUnits(kb.units);
    }

    openHelp() {
        this.dialog.open(HelpDialogComponent);
    }

    openAbout() {
        this.dialog.open(AboutDialogComponent);
    }
}

function flattenUnits(units: Array<Unit>): Array<FlatUnit> {
    return units.map((unit) => {
        const flat: FlatUnit = {
            owner: unit.owner,
            name: unit.name,
            receivedDmg: unit.receivedDamage.total,
            receivedFriendlyFire: unit.receivedDamage.friendlyFire,
            totalDmg: unit.damage.total,
            friendlyFire: unit.damage.friendlyFire,
            kills: unit.kills,
            exp: unit.exp,
        };

        unit.damage.rounds.forEach((dmg, index) => {
            flat[`round${index}`] = dmg;
        });

        return flat;
    });
}
