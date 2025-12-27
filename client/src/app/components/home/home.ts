
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, FileStatus } from '../../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styles: [`
    .dragover { border-color: #6366f1; background-color: #eef2ff; }
  `]
})
export class HomeComponent implements OnInit {
  files: FileStatus[] = [];
  uploading = false;
  uploadStatus = '';
  toastMessage = '';
  showToast = false;

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadDatabases();
  }

  loadDatabases() {
    this.api.getFilesStatus().subscribe({
      next: (data) => {
        this.files = data.files;
      },
      error: (err) => console.error("Failed to load files", err)
    });
  }

  triggerUpload() {
    document.getElementById('folderInput')?.click();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    (event.target as HTMLElement).closest('.upload-area')?.classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    (event.target as HTMLElement).closest('.upload-area')?.classList.remove('dragover');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    (event.target as HTMLElement).closest('.upload-area')?.classList.remove('dragover');
    if (event.dataTransfer?.files) {
      this.handleUpload(event.dataTransfer.files);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleUpload(input.files);
    }
  }

  handleUpload(fileList: FileList) {
    if (fileList.length === 0) return;

    this.uploading = true;
    this.uploadStatus = `Uploading ${fileList.length} files...`;

    const formData = new FormData();
    Array.from(fileList).forEach(file => {
      // @ts-ignore: webkitRelativePath exists on File object in browsers
      const path = file.webkitRelativePath || file.name;
      formData.append('files', file, path);
    });

    this.api.uploadFolder(formData).subscribe({
      next: (data) => {
        if (data.success) {
          this.showToastMsg(`✅ Uploaded ${data.count} files`);
          this.loadDatabases();
        }
        this.uploading = false;
      },
      error: (err) => {
        this.showToastMsg('❌ Upload failed: ' + err.message);
        this.uploading = false;
      }
    });
  }

  analyzeFile(file: FileStatus) {
    // Optimistic Update? No, wait for response
    this.showToastMsg('Starting analysis...');

    this.api.analyzeFile(file.name).subscribe({
      next: (data) => {
        if (data.success) {
          this.showToastMsg('✅ Analysis Complete!');
          this.loadDatabases();
        } else {
          this.showToastMsg('❌ Analysis failed');
        }
      },
      error: (err) => this.showToastMsg('❌ Analysis Failed: ' + err.message)
    });
  }

  deleteFile(file: FileStatus) {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

    this.api.deleteFile(file.name).subscribe({
      next: (data) => {
        if (data.success) {
          this.showToastMsg('🗑️ File deleted');
          this.loadDatabases();
        }
      },
      error: (err) => this.showToastMsg('❌ Delete failed: ' + err.message)
    });
  }

  openEditor(fileId: string) {
    this.router.navigate(['/editor', fileId]);
  }

  openPreview(fileId: string) {
    window.open(`/api/preview/${fileId}`, '_blank');
  }

  showToastMsg(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }
}
