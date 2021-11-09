import { Pipe, PipeTransform } from '@angular/core';
import moment from 'moment';

@Pipe({
    name: 'formatDate',
})
export class FormatDatePipe implements PipeTransform {
    transform(value?: Date | string | number): string {
        if (!value) return '';
        return moment(value).format('DD.MM.YYYY, HH:mm:ss');
    }
}
