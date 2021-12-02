import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { FlatUnit } from '../../_model/flat-unit';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

@Component({
    selector: 'app-analysis-result',
    templateUrl: './analysis-result.component.html',
    styleUrls: ['./analysis-result.component.scss'],
})
export class AnalysisResultComponent implements AfterViewInit {
    dataSource = new MatTableDataSource<FlatUnit>();
    columns: Array<any> = [];
    displayedColumns: Array<any> = [];
    @ViewChild(MatSort) sort?: MatSort;

    @Input() set data(data: Array<FlatUnit>) {
        this.updateTable(data);
    }

    applyFilter(event: Event) {
        if (!this.dataSource) return;
        const filterValue = (event.target as HTMLInputElement).value;
        this.dataSource.filter = filterValue.trim().toLowerCase();
    }

    ngAfterViewInit(): void {
        if (this.sort) {
            this.dataSource.sort = this.sort;
        }
    }

    isStickyColumn(columnDef: string): boolean {
        return ['name'].includes(columnDef);
    }

    private updateTable(data: Array<FlatUnit>): void {
        this.dataSource.data = data;

        const columnNames = data
            .reduce((columns: Array<string>, unit) => {
                return [...columns, ...Object.keys(unit)];
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
    }
}
