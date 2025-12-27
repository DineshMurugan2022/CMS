
import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { EditorComponent } from './components/editor/editor';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'editor/:fileId', component: EditorComponent },
    { path: '**', redirectTo: '' }
];
