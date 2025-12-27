
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FileStatus {
    name: string;
    dbId: string;
    hasDb: boolean;
}

export interface DatabaseResponse {
    success: boolean;
    schema: any;
    data: any;
}

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private apiUrl = '/api';

    constructor(private http: HttpClient) { }

    getFilesStatus(): Observable<{ files: FileStatus[] }> {
        return this.http.get<{ files: FileStatus[] }>(`${this.apiUrl}/files-status`);
    }

    uploadFolder(formData: FormData): Observable<any> {
        return this.http.post(`${this.apiUrl}/upload-folder`, formData);
    }

    analyzeFile(filename: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/analyze-file`, { filename });
    }

    deleteFile(filename: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/file/${filename}`);
    }

    getDatabase(fileId: string): Observable<DatabaseResponse> {
        return this.http.get<DatabaseResponse>(`${this.apiUrl}/database/${fileId}`);
    }

    updateRecord(fileId: string, table: string, id: number | string, data: any): Observable<any> {
        return this.http.put(`${this.apiUrl}/database/${fileId}/${table}/${id}`, data);
    }

    createAdmin(fileId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/${fileId}`, {});
    }

    downloadProject(fileId: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/download/${fileId}`, { responseType: 'blob' });
    }
}
