
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileStatus } from '../../services/api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html'
})
export class SidebarComponent {
  @Input() files: FileStatus[] = [];
  @Input() activeFileId: string = '';
  @Input() schema: any = null;
  @Input() activeTable: string = '';

  @Output() fileSelected = new EventEmitter<FileStatus>();
  @Output() tableSelected = new EventEmitter<string>();

  selectFile(file: FileStatus) {
    this.fileSelected.emit(file);
  }

  selectTable(tableName: string) {
    this.tableSelected.emit(tableName);
  }

  formatName(str: string): string {
    if (!str) return '';
    if (str === 'sqlite_sequence') return '';
    return str
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}
