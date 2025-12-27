
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, FileStatus } from '../../services/api.service';
import { SidebarComponent } from '../sidebar/sidebar';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './editor.html',
  styles: [`
    .preview-pane { transition: width 0.3s ease; }
    .glass-panel { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }
  `]
})
export class EditorComponent implements OnInit {
  fileId: string = '';
  files: FileStatus[] = [];
  dbSchema: any = null;
  dbData: any = null;
  activeTable: string = '';
  activeRows: any[] = [];
  tableColumns: any[] = [];

  previewUrl: SafeResourceUrl | null = null;
  showPreview = false;
  toastMessage = '';
  showToast = false;
  toastType = 'success'; // success, error

  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.fileId = params.get('fileId') || '';
      if (this.fileId) {
        this.initEditor();
      }
    });

    // Determine initial split view state
    this.showPreview = window.innerWidth > 1024;
  }

  initEditor() {
    this.loadFiles();
    this.loadDatabase();
    this.updatePreviewUrl();
  }

  loadFiles() {
    this.api.getFilesStatus().subscribe(data => {
      // Only show files with DBs
      this.files = data.files.filter(f => f.hasDb);
    });
  }

  loadDatabase() {
    this.api.getDatabase(this.fileId).subscribe({
      next: (data) => {
        if (data.success) {
          this.dbSchema = data.schema;
          this.dbData = data.data;

          // Auto-select first table if none selected
          if (!this.activeTable && this.dbSchema.tables.length > 0) {
            const first = this.dbSchema.tables.find((t: any) => t.name !== 'sqlite_sequence');
            if (first) this.selectTable(first.name);
          } else if (this.activeTable) {
            // Refresh current view
            this.selectTable(this.activeTable);
          }
        }
      },
      error: (err) => this.showToastMsg('Failed to load database: ' + err.message, 'error')
    });
  }

  updatePreviewUrl() {
    // We use safe resource URL to allow iframe
    this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`/api/preview/${this.fileId}`);
  }

  onFileSelected(file: FileStatus) {
    this.router.navigate(['/editor', file.dbId]);
  }

  selectTable(tableName: string) {
    this.activeTable = tableName;
    this.activeRows = this.dbData[tableName] || [];

    const tableDef = this.dbSchema.tables.find((t: any) => t.name === tableName);
    this.tableColumns = tableDef ? tableDef.columns.filter((c: any) => !['id', 'created_at', 'updated_at'].includes(c.name)) : [];
  }

  isLongText(colName: string, colType: string): boolean {
    return colName.includes('content') || colName.includes('description') || colType === 'TEXT';
  }

  isImage(colName: string): boolean {
    return colName.includes('image') || colName.includes('src');
  }

  getImagePreview(val: string): string {
    if (!val) return '';
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('/')) {
      return val;
    }
    return `/uploads/${val}`;
  }

  saveField(row: any, col: any, value: any, inputElement: HTMLElement) {
    const originalBorder = inputElement.style.borderColor;
    inputElement.style.borderColor = '#fbbf24'; // Saving

    const payload = { [col.name]: value };

    this.api.updateRecord(this.fileId, this.activeTable, row.id, payload).subscribe({
      next: () => {
        inputElement.style.borderColor = '#22c55e'; // Success
        this.showToastMsg('Saved');
        this.reloadPreview();
        setTimeout(() => inputElement.style.borderColor = '', 1000);
      },
      error: (err) => {
        inputElement.style.borderColor = '#ef4444'; // Error
        this.showToastMsg('Error: ' + err.message, 'error');
      }
    });
  }

  togglePreview() {
    this.showPreview = !this.showPreview;
  }

  reloadPreview() {
    if (this.previewFrame && this.previewFrame.nativeElement.contentWindow) {
      this.previewFrame.nativeElement.contentWindow.location.reload();
    }
  }

  downloadProject() {
    this.showToastMsg('Preparing download...', 'success');
    this.api.downloadProject(this.fileId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.fileId}-export.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        this.showToastMsg('Download started!');
      },
      error: (err) => this.showToastMsg('Download failed: ' + err.message, 'error')
    });
  }

  showToastMsg(msg: string, type: 'success' | 'error' = 'success') {
    this.toastMessage = msg;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }

  formatName(str: string): string {
    if (!str) return '';
    return str
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
}
