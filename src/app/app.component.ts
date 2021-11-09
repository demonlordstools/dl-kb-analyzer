import { Component } from '@angular/core';
import { KbParserService } from './_util/kb-parser.service';
import { Unit } from './_model/unit';
import { KB } from './_model/kb';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {
    flattenedUnits: Array<any> = [];
    dataSource: Array<any> = [];

    columns: Array<any> = [];
    displayedColumns: Array<any> = [];
    storedKBs: Array<KB> = [];

    constructor(private kbParser: KbParserService) {
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

        const columnNames = this.flattenedUnits
            .reduce((columns, row) => {
                return [...columns, ...Object.keys(row)];
            }, [])
            .reduce((columns: Array<string>, column: string) => {
                return columns.includes(column)
                    ? columns
                    : [...columns, column];
            }, []);
        this.columns = columnNames.map((column: string) => {
            return {
                columnDef: column,
                header: column,
                cell: (element: any) =>
                    `${element[column] ? element[column] : ``}`,
            };
        });
        this.displayedColumns = this.columns.map((c) => c.columnDef);
        this.dataSource = this.flattenedUnits
            .slice()
            .sort((a, b) => b.totalDmg - a.totalDmg);
    }
}

function flattenUnits(units: Array<Unit>): Array<any> {
    return units.map((unit) => {
        const flat: Record<string, unknown> = {
            name: unit.name,
            totalDmg: unit.damage.total,
        };

        unit.damage.rounds.forEach((dmg, index) => {
            flat[`round${index}`] = dmg;
        });

        return flat;
    });
}
